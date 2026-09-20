import type { DecisionQuestion } from "@/lib/valorant/decisions/engine"
import type { PlayerProfile, RoundReport } from "@/lib/valorant/types"

export const ROUND_REASON_KEY = "round_reason"
export const ROUND_TIER_KEY = "contribution_tier"
export const ROUND_REVIEW_KEY = "needs_review"

export const TIER_LABELS = ["저기여", "보통", "고기여"] as const

export const ROUND_REASON_CRITERIA = {
  "고기여 패배": "팀이 패배했지만 이 플레이어의 기여 점수가 360 이상으로 매우 높았다",
  "첫 데스 후 미교환": "이 플레이어가 라운드 첫 사망자였고 팀이 그 데스를 교환하지 못했다",
  "고비용 언트레이드 데스": "이 플레이어가 3000 이상을 소비한 후 사망했고 교환되지 않았다",
  "첫 킬로 라운드 개입": "이 플레이어가 라운드 첫 킬을 기록했다",
  "저기여 승리": "팀이 승리했지만 이 플레이어의 기여 점수가 180 미만으로 낮았다",
  "사망 후 교환 성공": "이 플레이어가 사망했지만 팀이 곧바로 교환했다",
  "안정 라운드": "위 유형 중 어느 것에도 해당하지 않는 평범한 라운드",
} as const

export function roundQuestions(): readonly DecisionQuestion[] {
  return [
    {
      kind: "choice",
      key: ROUND_REASON_KEY,
      instructions:
        "라운드 상태를 보고 판정 유형 하나를 고른다. 여러 유형이 동시에 성립하면 criteria에 먼저 나열된 유형을 우선한다",
      criteria: ROUND_REASON_CRITERIA,
    },
    {
      kind: "score",
      key: ROUND_TIER_KEY,
      instructions: "이 플레이어가 라운드 승패에 미친 기여 수준을 평가한다",
      levels: [
        "저기여: 승패에 거의 영향이 없었다",
        "보통: 평균적인 수준의 기여를 했다",
        "고기여: 라운드 결과를 사실상 좌우했다",
      ],
    },
    {
      kind: "noul",
      key: ROUND_REVIEW_KEY,
      instructions:
        "이 라운드는 실수·고기여 패배·클러치 같은 예외 상황을 포함해 플레이어가 복기할 가치가 있다",
    },
  ]
}

export function roundState(round: RoundReport): string {
  const flags = [
    round.survived ? "생존" : "사망",
    round.traded ? "교환됨" : null,
    round.firstBlood ? "첫 킬" : null,
    round.firstDeath ? "첫 데스" : null,
    round.untradedDeath ? "미교환 사망" : null,
    round.clutchAttempt ? "클러치 시도" : null,
    round.clutchWin ? "클러치 성공" : null,
    round.kast ? "KAST 달성" : "KAST 실패",
  ].filter((flag) => flag !== null)
  return [
    `맵 ${round.mapName} / 라운드 ${round.round} / 결과 ${round.result === "win" ? "승리" : "패배"}`,
    `기록: ${round.kills}킬 ${round.assists}어시 ${round.damage}딜 점수${round.score} / 기여 점수 ${round.contributionScore}`,
    `경제: 로드아웃 ${round.loadoutValue} / 소비 ${round.spent} / 잔여 ${round.remaining} / 무기 ${round.weaponName} / 방어구 ${round.armorName}`,
    `상태: ${flags.join(", ")}`,
  ].join("\n")
}

export function tierLabelForScore(score: number): string {
  const index = Math.min(Math.max(Math.round(score), 0), TIER_LABELS.length - 1)
  return TIER_LABELS[index] ?? "보통"
}

export const PROFILE_STRONG_AXIS_KEY = "profile_strong_axis"
export const PROFILE_WEAK_AXIS_KEY = "profile_weak_axis"
export const PROFILE_FORM_KEY = "profile_form_trend"
export const PROFILE_AGENT_KEY = "profile_agent_pick"

export const PROFILE_AXES = {
  "교전 생산성": "평균 ACS — 라운드 교전에서 만드는 직접 생산성",
  "데미지 압박": "평균 ADR — 킬과 무관하게 매 라운드 쌓는 체력 압박",
  "교전 효율": "K/D — 데스를 내주지 않고 킬을 가져가는 효율",
  "팀 연계": "경기당 어시스트 — 유틸·트레이드로 팀 교전을 잇는 기여",
} as const

export const PROFILE_FORM_CRITERIA = {
  상승세: "최근 경기의 승률과 전투 지표가 평소 평균보다 좋아지고 있다",
  유지: "최근 경기가 평소 수준과 큰 차이 없이 유지되고 있다",
  하락세: "최근 경기의 승률과 전투 지표가 평소 평균보다 떨어지고 있다",
} as const

export const PROFILE_AGENT_SLOTS = 8
const PROFILE_RECENT_MATCHES = 8

export function profileQuestions(profile: PlayerProfile): readonly DecisionQuestion[] {
  const agentCriteria: Record<string, string> = {}
  for (const agent of profile.insights.agentBreakdown.slice(0, PROFILE_AGENT_SLOTS)) {
    agentCriteria[agent.name] =
      `${agent.name} — ${agent.matches}경기 · 승률 ${agent.winRate}% · ACS ${agent.averageAcs} · K/D ${agent.kdRatio} · 기여 ${agent.impactScore}`
  }
  return [
    {
      kind: "choice",
      key: PROFILE_STRONG_AXIS_KEY,
      instructions:
        "평균 지표를 보고 이 선수의 지표들 중 상대적으로 가장 강한 축 하나를 고른다. 절대 수치가 높지 않아도 이 선수 안에서 가장 나은 축을 고른다",
      criteria: PROFILE_AXES,
    },
    {
      kind: "choice",
      key: PROFILE_WEAK_AXIS_KEY,
      instructions: "평균 지표를 보고 이 선수의 지표들 중 상대적으로 가장 약한 축 하나를 고른다",
      criteria: PROFILE_AXES,
    },
    {
      kind: "choice",
      key: PROFILE_FORM_KEY,
      instructions: "최근 경기 목록의 결과와 지표를 평소 평균과 비교해 현재 폼 추세를 고른다",
      criteria: PROFILE_FORM_CRITERIA,
    },
    {
      kind: "choice",
      key: PROFILE_AGENT_KEY,
      instructions:
        "요원별 기록을 보고 이 선수가 집중 연습했을 때 성과 향상 가능성이 가장 큰 요원 하나를 고른다",
      criteria: agentCriteria,
    },
  ]
}

export function profileState(profile: PlayerProfile): string {
  const summary = profile.summary
  const perMatchAssists = summary.matches > 0 ? (summary.assists / summary.matches).toFixed(1) : "0"
  const recent = profile.recentMatches
    .slice(0, PROFILE_RECENT_MATCHES)
    .map(
      (match) =>
        `${match.result === "win" ? "승" : "패"} ${match.score} ACS${match.acs} ${match.agent}@${match.mapName}`,
    )
  return [
    `플레이어 ${profile.displayName}#${profile.tag} (${profile.region}) / 랭크 ${profile.rank} / 경쟁전 ${summary.matches}경기`,
    `평균 지표: 승률 ${summary.winRate}% / ACS ${summary.averageAcs} / ADR ${summary.adr} / K/D ${summary.kdRatio} / 헤드샷 ${summary.headshotRate}% / 경기당 어시스트 ${perMatchAssists} / 통합 기여 ${profile.insights.impactScore}`,
    `최근 경기(최신순): ${recent.length > 0 ? recent.join(" | ") : "없음"}`,
  ].join("\n")
}
