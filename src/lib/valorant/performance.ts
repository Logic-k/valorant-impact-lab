import { average, averageDecimal, ratio, winRate } from "@/lib/valorant/analysis"
import type { MatchDigest, PerformanceBreakdown, PerformanceInsights } from "@/lib/valorant/types"

type CoverageInput = {
  readonly storedMatches: number
  readonly competitiveMatches: number
}

type GroupBucket = {
  readonly key: string
  readonly matches: MatchDigest[]
}

export function buildPerformanceInsights(
  matches: readonly MatchDigest[],
  coverage: CoverageInput,
): PerformanceInsights {
  const impactScore = contributionScore(matches)

  return {
    coverage: {
      storedMatches: coverage.storedMatches,
      competitiveMatches: coverage.competitiveMatches,
      rangeLabel: rangeLabel(matches),
      seasonMode: "stored_range",
      limitation:
        "HenrikDev stored-matches 기준입니다. 공식 Act 전체 DB가 아니라 서버에 저장된 경기 범위만 분석합니다.",
    },
    impactScore,
    impactLabel: impactLabel(impactScore),
    strengths: strengths(matches),
    risks: risks(matches),
    agentBreakdown: breakdownBy(matches, (match) => match.agent),
    mapBreakdown: breakdownBy(matches, (match) => match.mapName),
    periodBreakdown: periodBreakdown(matches),
  }
}

function breakdownBy(
  matches: readonly MatchDigest[],
  keyFor: (match: MatchDigest) => string,
): readonly PerformanceBreakdown[] {
  const buckets = new Map<string, MatchDigest[]>()
  for (const match of matches) {
    const key = keyFor(match)
    const bucket = buckets.get(key) ?? []
    bucket.push(match)
    buckets.set(key, bucket)
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => toBreakdown({ key, matches: bucket }))
    .sort((left, right) => right.matches - left.matches || right.impactScore - left.impactScore)
}

function toBreakdown(bucket: GroupBucket): PerformanceBreakdown {
  const kills = bucket.matches.reduce((sum, match) => sum + match.kills, 0)
  const deaths = bucket.matches.reduce((sum, match) => sum + match.deaths, 0)

  return {
    name: bucket.key,
    matches: bucket.matches.length,
    winRate: winRate(bucket.matches),
    averageAcs: average(bucket.matches.map((match) => match.acs)),
    kdRatio: ratio(kills, deaths, 2),
    adr: averageDecimal(
      bucket.matches.map((match) => match.adr),
      1,
    ),
    headshotRate: averageDecimal(
      bucket.matches.map((match) => match.headshotRate),
      1,
    ),
    impactScore: contributionScore(bucket.matches),
  }
}

function periodBreakdown(matches: readonly MatchDigest[]): readonly PerformanceBreakdown[] {
  return breakdownBy(matches, (match) => monthKey(match.startedAt))
    .map((row) => ({
      ...row,
      dateRange: rangeLabel(matches.filter((match) => monthKey(match.startedAt) === row.name)),
    }))
    .sort((left, right) => right.name.localeCompare(left.name))
}

function contributionScore(matches: readonly MatchDigest[]): number {
  if (matches.length === 0) {
    return 0
  }
  const kills = matches.reduce((sum, match) => sum + match.kills, 0)
  const deaths = matches.reduce((sum, match) => sum + match.deaths, 0)
  const assists = matches.reduce((sum, match) => sum + match.assists, 0)
  const acsSignal = clamp(average(matches.map((match) => match.acs)) / 3)
  const adrSignal = clamp(
    averageDecimal(
      matches.map((match) => match.adr),
      1,
    ) / 1.6,
  )
  const duelSignal = clamp(ratio(kills, deaths, 2) * 45)
  const supportSignal = clamp((assists / matches.length) * 10)
  const conversionSignal = winRate(matches)
  return Math.round((acsSignal + adrSignal + duelSignal + supportSignal + conversionSignal) / 5)
}

function strengths(matches: readonly MatchDigest[]): readonly string[] {
  const values = baseSignals(matches)
  return values
    .filter((signal) => signal.value >= signal.strongAt)
    .map((signal) => signal.strongLabel)
    .slice(0, 3)
}

function risks(matches: readonly MatchDigest[]): readonly string[] {
  const values = baseSignals(matches)
  return values
    .filter((signal) => signal.value <= signal.weakAt)
    .map((signal) => signal.weakLabel)
    .slice(0, 3)
}

export const SIGNAL_LIMITS = {
  acs: { strongAt: 230, weakAt: 160 },
  adr: { strongAt: 145, weakAt: 105 },
  kd: { strongAt: 1.15, weakAt: 0.85 },
  assists: { strongAt: 6, weakAt: 3 },
} as const

function baseSignals(matches: readonly MatchDigest[]) {
  const kills = matches.reduce((sum, match) => sum + match.kills, 0)
  const deaths = matches.reduce((sum, match) => sum + match.deaths, 0)
  const assists = matches.reduce((sum, match) => sum + match.assists, 0)
  const matchCount = Math.max(matches.length, 1)
  return [
    {
      value: average(matches.map((match) => match.acs)),
      ...SIGNAL_LIMITS.acs,
      strongLabel: "교전 생산성이 높아 라운드 초반 영향력이 큽니다.",
      weakLabel: "ACS가 낮아 직접 교전 기여를 끌어올릴 여지가 있습니다.",
    },
    {
      value: averageDecimal(
        matches.map((match) => match.adr),
        1,
      ),
      ...SIGNAL_LIMITS.adr,
      strongLabel: "ADR이 높아 킬이 없어도 체력 압박을 꾸준히 만듭니다.",
      weakLabel: "ADR이 낮아 교전 전 데미지 교환을 더 만들어야 합니다.",
    },
    {
      value: ratio(kills, deaths, 2),
      ...SIGNAL_LIMITS.kd,
      strongLabel: "K/D가 안정적이라 불리한 데스 누수가 적습니다.",
      weakLabel: "K/D가 낮아 첫 교전 선택과 생존 판단 점검이 필요합니다.",
    },
    {
      value: assists / matchCount,
      ...SIGNAL_LIMITS.assists,
      strongLabel: "어시스트 밀도가 좋아 팀 교전 연결에 기여합니다.",
      weakLabel: "어시스트 밀도가 낮아 유틸/트레이드 연결 지표가 약합니다.",
    },
  ] as const
}

function rangeLabel(matches: readonly MatchDigest[]): string {
  const dates = matches.map((match) => match.startedAt.slice(0, 10)).sort()
  const first = dates[0]
  const last = dates.at(-1)
  if (first === undefined || last === undefined) {
    return "저장 경기 없음"
  }
  return first === last ? first : `${first} ~ ${last}`
}

function monthKey(startedAt: string): string {
  return startedAt.slice(0, 7)
}

function impactLabel(score: number): string {
  if (score >= 75) {
    return "높음"
  }
  if (score >= 55) {
    return "보통"
  }
  return "개선 필요"
}

function clamp(value: number): number {
  if (value < 0) {
    return 0
  }
  if (value > 100) {
    return 100
  }
  return value
}
