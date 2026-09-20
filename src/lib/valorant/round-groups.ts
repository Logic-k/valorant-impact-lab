import { average, ratio } from "@/lib/valorant/analysis"
import type { RoundMatchReport, RoundReport } from "@/lib/valorant/types"

export function buildRoundMatchReports(
  rounds: readonly RoundReport[],
): readonly RoundMatchReport[] {
  const reports = new Map<string, RoundReport[]>()
  for (const round of rounds) {
    const existing = reports.get(round.matchId)
    if (existing === undefined) {
      reports.set(round.matchId, [round])
    } else {
      existing.push(round)
    }
  }

  return [...reports.entries()].map(([matchId, matchRounds]) => {
    const firstRound = matchRounds[0]
    const kills = sum(matchRounds.map((round) => round.kills))
    const assists = sum(matchRounds.map((round) => round.assists))
    const damage = sum(matchRounds.map((round) => round.damage))
    const kastRate = percent(matchRounds.filter((round) => round.kast).length, matchRounds.length)
    const survivalRate = percent(
      matchRounds.filter((round) => round.survived).length,
      matchRounds.length,
    )
    const tradeRate = percent(
      matchRounds.filter((round) => round.traded).length,
      matchRounds.length,
    )
    const averageContributionScore = Math.round(
      average(matchRounds.map((round) => round.contributionScore)),
    )
    const impactLabel = labelForMatchImpact(averageContributionScore, kastRate)
    return {
      matchId,
      mapName: firstRound?.mapName ?? "Unknown",
      startedAt: firstRound?.startedAt ?? "",
      rounds: matchRounds,
      wins: matchRounds.filter((round) => round.result === "win").length,
      losses: matchRounds.filter((round) => round.result === "loss").length,
      kills,
      assists,
      damage,
      kastRate,
      survivalRate,
      tradeRate,
      averageContributionScore,
      impactLabel,
      summary: summaryForMatch({
        averageContributionScore,
        damage,
        firstBloods: matchRounds.filter((round) => round.firstBlood).length,
        highPriorityRounds: matchRounds.filter((round) => round.reviewPriority === "high").length,
        kastRate,
        kills,
        rounds: matchRounds.length,
        untradedDeaths: matchRounds.filter((round) => round.untradedDeath).length,
      }),
      highPriorityRounds: matchRounds.filter((round) => round.reviewPriority === "high").length,
      firstBloods: matchRounds.filter((round) => round.firstBlood).length,
      firstDeaths: matchRounds.filter((round) => round.firstDeath).length,
      untradedDeaths: matchRounds.filter((round) => round.untradedDeath).length,
    }
  })
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function percent(value: number, total: number): number {
  return ratio(value * 100, total, 0)
}

function labelForMatchImpact(
  averageContributionScore: number,
  kastRate: number,
): RoundMatchReport["impactLabel"] {
  if (averageContributionScore >= 360 || kastRate >= 75) {
    return "강한 기여"
  }
  if (averageContributionScore >= 220 || kastRate >= 55) {
    return "보통 기여"
  }
  return "낮은 기여"
}

function summaryForMatch(input: {
  readonly averageContributionScore: number
  readonly damage: number
  readonly firstBloods: number
  readonly highPriorityRounds: number
  readonly kastRate: number
  readonly kills: number
  readonly rounds: number
  readonly untradedDeaths: number
}): readonly string[] {
  return [
    `${input.rounds}라운드 중 ${Math.round((input.kastRate * input.rounds) / 100)}라운드 KAST`,
    `${input.kills}킬 ${input.damage}딜, 평균 기여점수 ${input.averageContributionScore}`,
    `첫 킬 ${input.firstBloods}회, 미교환 사망 ${input.untradedDeaths}회`,
    `강한 리뷰 후보 ${input.highPriorityRounds}라운드`,
  ]
}
