import { average, ratio } from "@/lib/valorant/analysis"
import type { MatchDetailData } from "@/lib/valorant/providers/henrik-schemas"
import { buildRoundMatchReports } from "@/lib/valorant/round-groups"
import { eventsForDetail } from "@/lib/valorant/round-map-events"
import { evaluateRoundReview, sortReviewRounds } from "@/lib/valorant/round-review"
import { buildRoundEvidence, buildRoundTimeline } from "@/lib/valorant/round-timeline"
import type { PlayerLookup, RoundDetailInsights, RoundReport } from "@/lib/valorant/types"

const TRADE_WINDOW_MS = 5_000
type Team = "Blue" | "Red"

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
    note: `${matchReports.length}개 경쟁전 match detail 기준입니다. 경기별 전체 라운드에서 첫 교전, 교환, 생존, 경제 손실, 고기여 패배를 표시합니다.`,
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
    const traded = death === undefined ? false : wasTraded(roundKills, death)
    const clutchAttempt = wasClutchAttempt(detail, player.puuid, stats.player_team, index)
    const result = round.winning_team === stats.player_team ? "win" : "loss"
    const firstKill = roundKills[0]
    const firstBlood = firstKill?.killer_puuid === player.puuid
    const firstDeath = firstKill?.victim_puuid === player.puuid
    const untradedDeath = death !== undefined && !traded
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

function wasTraded(
  kills: readonly MatchDetailData["kills"][number][],
  death: MatchDetailData["kills"][number],
) {
  return kills.some(
    (kill) =>
      kill.killer_team === death.victim_team &&
      kill.victim_puuid === death.killer_puuid &&
      kill.kill_time_in_round > death.kill_time_in_round &&
      kill.kill_time_in_round - death.kill_time_in_round <= TRADE_WINDOW_MS,
  )
}

function wasClutchAttempt(
  detail: MatchDetailData,
  puuid: string,
  playerTeam: string,
  roundIndex: number,
): boolean {
  if (!isTeam(playerTeam)) {
    return false
  }
  const enemyTeam = playerTeam === "Red" ? "Blue" : "Red"
  const alive = {
    Blue: detail.players.all_players.filter((player) => player.team === "Blue").length,
    Red: detail.players.all_players.filter((player) => player.team === "Red").length,
  } satisfies Record<Team, number>
  for (const kill of killsForRound(detail, roundIndex)) {
    if (alive[playerTeam] === 1 && alive[enemyTeam] > 0) {
      return true
    }
    if (kill.victim_puuid === puuid) {
      return false
    }
    if (kill.victim_team === "Blue" || kill.victim_team === "Red") {
      alive[kill.victim_team] -= 1
    }
  }
  return alive[playerTeam] === 1 && alive[enemyTeam] > 0
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

function isTeam(value: string): value is Team {
  return value === "Blue" || value === "Red"
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
