import { average, ratio } from "@/lib/valorant/analysis"
import type { MatchDetailData } from "@/lib/valorant/providers/henrik-schemas"
import { buildRoundMatchReports } from "@/lib/valorant/round-groups"
import { eventsForDetail } from "@/lib/valorant/round-map-events"
import { evaluateRoundReview, sortReviewRounds } from "@/lib/valorant/round-review"
import {
  alivePlayersBefore,
  buyTypeFor,
  clutchSize,
  econRating,
  findTrade,
  hasTradeableAlly,
  openingTeam,
  teamLoadoutAverage,
} from "@/lib/valorant/round-tactics"
import { buildRoundEvidence, buildRoundTimeline } from "@/lib/valorant/round-timeline"
import type {
  BuyBreakdown,
  BuyType,
  ClutchBreakdown,
  OpeningDuelInsights,
  PlayerLookup,
  RoundDetailInsights,
  RoundReport,
} from "@/lib/valorant/types"

const BUY_TYPES: readonly BuyType[] = ["eco", "semi", "full"]

export function buildRoundDetailInsights(
  lookup: PlayerLookup,
  details: readonly MatchDetailData[],
): RoundDetailInsights {
  const reports = details.flatMap((detail) => reportsForDetail(lookup, detail))
  const events = details.flatMap((detail) => eventsForDetail(lookup, detail))
  const clutchAttempts = reports.filter((round) => round.clutchAttempt).length
  const reviewRounds = sortReviewRounds(reports)
  const matchReports = buildRoundMatchReports(reports)

  return {
    matchesAnalyzed: details.length,
    roundsAnalyzed: reports.length,
    kastRate: percent(reports.filter((round) => round.kast).length, reports.length),
    survivalRate: percent(reports.filter((round) => round.survived).length, reports.length),
    tradeRate: percent(reports.filter((round) => round.traded).length, reports.length),
    clutchAttempts,
    clutchWins: reports.filter((round) => round.clutchWin).length,
    firstBloods: reports.filter((round) => round.firstBlood).length,
    firstDeaths: reports.filter((round) => round.firstDeath).length,
    untradedDeaths: reports.filter((round) => round.untradedDeath).length,
    highImpactLosses: reports.filter(
      (round) => round.result === "loss" && round.contributionLabel === "고기여",
    ).length,
    lowImpactWins: reports.filter(
      (round) => round.result === "win" && round.contributionLabel === "저기여",
    ).length,
    reviewRoundCount: reviewRounds.length,
    averageLoadoutValue: average(reports.map((round) => round.loadoutValue)),
    averageSpent: average(reports.map((round) => round.spent)),
    openingDuel: openingDuelInsights(reports),
    clutchBreakdown: clutchBreakdown(reports),
    buyBreakdown: buyBreakdown(reports),
    tradeableUntradedDeaths: reports.filter((round) => round.untradedDeath && round.tradeableDeath)
      .length,
    econRating: average(reports.map((round) => round.econRating)),
    note: `${matchReports.length}개 경쟁전 match detail 기준입니다. 경기별 전체 라운드에서 첫 교전, 3초·3000유닛 기준 교환, 5v4 전환, 클러치, 바이 타입, 고기여 패배를 표시합니다.`,
    rounds: reports,
    matchReports,
    reviewRounds,
    mapEvents: events,
  }
}

function reportsForDetail(lookup: PlayerLookup, detail: MatchDetailData): readonly RoundReport[] {
  const player = findPlayer(lookup, detail)
  if (player === undefined) {
    return []
  }
  const startedAt = startedAtForDetail(detail)
  return detail.rounds.flatMap((round, index) => {
    const stats = round.player_stats.find((entry) => entry.player_puuid === player.puuid)
    if (stats === undefined) {
      return []
    }
    const roundKills = killsForRound(detail, index)
    const death = roundKills.find((kill) => kill.victim_puuid === player.puuid)
    const survived = death === undefined
    const assists = roundKills.filter((kill) => assisted(kill.assistants, player.puuid)).length
    const traded = death === undefined ? false : findTrade(roundKills, death) !== undefined
    const size = clutchSize(detail, roundKills, player.puuid, stats.player_team)
    const clutchAttempt = size > 0
    const result = round.winning_team === stats.player_team ? "win" : "loss"
    const firstKill = roundKills[0]
    const firstBlood = firstKill?.killer_puuid === player.puuid
    const firstDeath = firstKill?.victim_puuid === player.puuid
    const untradedDeath = death !== undefined && !traded
    const tradeableDeath =
      death !== undefined &&
      hasTradeableAlly(
        death,
        alivePlayersBefore(detail, roundKills, death.kill_time_in_round),
        allyPuuids(detail, stats.player_team),
      )
    const opening = openingTeam(roundKills, stats.player_team)
    const ownLoadout = teamLoadoutAverage(round, stats.player_team)
    const enemyLoadout = enemyLoadoutAverage(round, stats.player_team)
    const buyType = buyTypeFor(ownLoadout)
    const enemyBuyType = buyTypeFor(enemyLoadout)
    const review = evaluateRoundReview({
      assists,
      damage: stats.damage,
      firstBlood,
      firstDeath,
      kills: stats.kills,
      result,
      score: stats.score,
      spent: stats.economy.spent,
      survived,
      traded,
    })
    const timeline = buildRoundTimeline({ detail, kills: roundKills, playerPuuid: player.puuid })
    const evidence = buildRoundEvidence({
      damage: stats.damage,
      firstBlood,
      firstDeath,
      kills: stats.kills,
      result,
      reviewReason: review.reviewReason,
      spent: stats.economy.spent,
      survived,
      traded,
      untradedDeath,
      tradeableDeath,
      openingTeam: opening,
      clutchSize: size,
      buyType,
      enemyBuyType,
    })

    return [
      {
        matchId: matchId(detail),
        mapName: detail.metadata.map,
        startedAt,
        round: index + 1,
        result,
        kast: stats.kills > 0 || assists > 0 || survived || traded,
        survived,
        traded,
        firstBlood,
        firstDeath,
        untradedDeath,
        clutchAttempt,
        clutchWin: clutchAttempt && result === "win",
        clutchSize: size,
        openingTeam: opening,
        tradeableDeath,
        buyType,
        enemyBuyType,
        loadoutDelta: ownLoadout - enemyLoadout,
        econRating: econRating(stats.damage, stats.economy.loadout_value),
        kills: stats.kills,
        assists,
        damage: stats.damage,
        score: stats.score,
        loadoutValue: stats.economy.loadout_value,
        spent: stats.economy.spent,
        remaining: stats.economy.remaining,
        weaponName: stats.economy.weapon?.name ?? "Unknown",
        armorName: stats.economy.armor?.name ?? "None",
        contributionLabel: review.contributionLabel,
        contributionScore: review.contributionScore,
        reviewPriority: review.reviewPriority,
        reviewReason: review.reviewReason,
        evidence,
        timeline,
      },
    ]
  })
}

function openingDuelInsights(reports: readonly RoundReport[]): OpeningDuelInsights {
  const firstBloods = reports.filter((round) => round.firstBlood).length
  const firstDeaths = reports.filter((round) => round.firstDeath).length
  const duels = firstBloods + firstDeaths
  const ownOpenings = reports.filter((round) => round.openingTeam === "own")
  const enemyOpenings = reports.filter((round) => round.openingTeam === "enemy")
  return {
    duels,
    successRate: percent(firstBloods, duels),
    participationRate: percent(duels, reports.length),
    teamFirstKillRounds: ownOpenings.length,
    teamFirstKillConversion: percent(
      ownOpenings.filter((round) => round.result === "win").length,
      ownOpenings.length,
    ),
    teamFirstDeathRounds: enemyOpenings.length,
    teamFirstDeathRecovery: percent(
      enemyOpenings.filter((round) => round.result === "win").length,
      enemyOpenings.length,
    ),
  }
}

function clutchBreakdown(reports: readonly RoundReport[]): readonly ClutchBreakdown[] {
  const sizes = [
    ...new Set(reports.filter((round) => round.clutchAttempt).map((r) => r.clutchSize)),
  ]
  return sizes
    .sort((left, right) => left - right)
    .map((size) => {
      const attempts = reports.filter((round) => round.clutchSize === size)
      return {
        size,
        attempts: attempts.length,
        wins: attempts.filter((round) => round.clutchWin).length,
      }
    })
}

function buyBreakdown(reports: readonly RoundReport[]): readonly BuyBreakdown[] {
  return BUY_TYPES.map((buyType) => {
    const rounds = reports.filter((round) => round.buyType === buyType)
    const mismatches = rounds.filter((round) => round.enemyBuyType !== buyType)
    return {
      buyType,
      rounds: rounds.length,
      winRate: percent(rounds.filter((round) => round.result === "win").length, rounds.length),
      mismatchRounds: mismatches.length,
      mismatchWinRate: percent(
        mismatches.filter((round) => round.result === "win").length,
        mismatches.length,
      ),
    }
  }).filter((entry) => entry.rounds > 0)
}

function allyPuuids(detail: MatchDetailData, team: string): ReadonlySet<string> {
  return new Set(
    detail.players.all_players
      .filter((player) => player.team === team)
      .map((player) => player.puuid),
  )
}

function enemyLoadoutAverage(round: MatchDetailData["rounds"][number], team: string): number {
  const enemyTeam = round.player_stats.find((entry) => entry.player_team !== team)?.player_team
  return enemyTeam === undefined ? 0 : teamLoadoutAverage(round, enemyTeam)
}

function killsForRound(detail: MatchDetailData, roundIndex: number) {
  return detail.kills
    .filter((kill) => kill.round === roundIndex)
    .sort((left, right) => left.kill_time_in_round - right.kill_time_in_round)
}

function findPlayer(lookup: PlayerLookup, detail: MatchDetailData) {
  return detail.players.all_players.find(
    (player) => player.name === lookup.name && player.tag === lookup.tag,
  )
}

function assisted(
  assistants: readonly {
    readonly assistant_puuid?: string | undefined
    readonly puuid?: string | undefined
  }[],
  puuid: string,
) {
  return assistants.some(
    (assistant) => assistant.assistant_puuid === puuid || assistant.puuid === puuid,
  )
}

function percent(value: number, total: number): number {
  return ratio(value * 100, total, 0)
}

function matchId(detail: MatchDetailData): string {
  return detail.metadata.matchid ?? detail.metadata.match_id ?? "unknown-match"
}

function startedAtForDetail(detail: MatchDetailData): string {
  if (detail.metadata.game_start !== undefined) {
    return new Date(detail.metadata.game_start * 1000).toISOString()
  }
  return detail.metadata.game_start_patched ?? ""
}
