import {
  average,
  averageDecimal,
  pentagonFromMatches,
  ratio,
  winRate,
} from "@/lib/valorant/analysis"
import { buildPerformanceInsights } from "@/lib/valorant/performance"
import type {
  AccountData,
  MatchDetailData,
  MmrData,
  StoredMatchData,
  StoredMmrHistoryEntry,
} from "@/lib/valorant/providers/henrik-schemas"
import { buildRoundDetailInsights } from "@/lib/valorant/round-analysis"
import type {
  MatchDigest,
  PlayerLookup,
  PlayerProfile,
  RankPoint,
  ValorantRegion,
} from "@/lib/valorant/types"

type CompetitiveStoredMatch = StoredMatchData & {
  readonly stats: StoredMatchData["stats"] & {
    readonly team: "Blue" | "Red"
  }
}

const TIER_NAMES: Record<number, string> = {
  0: "Unrated",
  3: "Iron 1",
  4: "Iron 2",
  5: "Iron 3",
  6: "Bronze 1",
  7: "Bronze 2",
  8: "Bronze 3",
  9: "Silver 1",
  10: "Silver 2",
  11: "Silver 3",
  12: "Gold 1",
  13: "Gold 2",
  14: "Gold 3",
  15: "Platinum 1",
  16: "Platinum 2",
  17: "Platinum 3",
  18: "Diamond 1",
  19: "Diamond 2",
  20: "Diamond 3",
  21: "Ascendant 1",
  22: "Ascendant 2",
  23: "Ascendant 3",
  24: "Immortal 1",
  25: "Immortal 2",
  26: "Immortal 3",
  27: "Radiant",
}

export function toProfile(
  lookup: PlayerLookup,
  account: AccountData,
  mmr: MmrData | null,
  matches: readonly StoredMatchData[],
  details: readonly MatchDetailData[] = [],
  mmrHistory: readonly StoredMmrHistoryEntry[] = [],
): PlayerProfile {
  const competitiveMatches = matches.filter(isCompetitiveStoredMatch).map(toDigest)
  const rrDelta = mmr?.current_data?.mmr_change_to_last_game
  const latestRank = competitiveMatches[0]?.rankAtMatch ?? "Unrated"
  const currentRank = mmr?.current_data?.currenttierpatched ?? mmr?.currenttierpatched
  const currentRr = mmr?.current_data?.ranking_in_tier ?? mmr?.ranking_in_tier ?? 0
  const kills = competitiveMatches.reduce((sum, match) => sum + match.kills, 0)
  const deaths = competitiveMatches.reduce((sum, match) => sum + match.deaths, 0)
  const assists = competitiveMatches.reduce((sum, match) => sum + match.assists, 0)
  const roundDetails = buildRoundDetailInsights(lookup, details)
  const outcomesByMatch = new Map(
    roundDetails.matchReports.map(
      (report) =>
        [
          report.matchId,
          [...report.rounds]
            .sort((left, right) => left.round - right.round)
            .map((round) => round.result),
        ] as const,
    ),
  )
  const enrichedMatches = competitiveMatches.map((match) =>
    outcomesByMatch.has(match.id)
      ? { ...match, roundOutcomes: outcomesByMatch.get(match.id) ?? [] }
      : match,
  )
  const visibleMatches = applyLatestRrChange(enrichedMatches, rrDelta).slice(0, 10)
  const recentTeamLuck = average(visibleMatches.slice(0, 8).map((match) => match.teamLuck))
  const survivalRate = roundDetails.roundsAnalyzed > 0 ? roundDetails.kastRate : undefined

  return {
    displayName: account.name,
    tag: account.tag,
    region: lookup.region,
    accountLevel: account.account_level ?? competitiveMatches[0]?.accountLevel ?? 0,
    rank: currentRank ?? latestRank,
    rr: currentRr,
    ...(rrDelta === undefined ? {} : { rrDelta }),
    source: "henrik",
    sourceLabel: "HenrikDev stored matches",
    consentState: "user_entered",
    summary: {
      matches: competitiveMatches.length,
      winRate: winRate(competitiveMatches),
      averageAcs: average(competitiveMatches.map((match) => match.acs)),
      kills,
      deaths,
      assists,
      kdRatio: ratio(kills, deaths, 2),
      kast: roundDetails.kastRate,
      adr: averageDecimal(
        competitiveMatches.map((match) => match.adr),
        1,
      ),
      headshotRate: averageDecimal(
        competitiveMatches.map((match) => match.headshotRate),
        1,
      ),
      teamLuck: average(competitiveMatches.map((match) => match.teamLuck)),
      recentTeamLuck,
    },
    pentagon: pentagonFromMatches(competitiveMatches, survivalRate),
    insights: buildPerformanceInsights(competitiveMatches, {
      storedMatches: matches.length,
      competitiveMatches: competitiveMatches.length,
    }),
    roundDetails,
    recentMatches: visibleMatches,
    rankHistory: mmrHistory.map(toRankPoint),
  }
}

export function toRankPoint(entry: StoredMmrHistoryEntry): RankPoint {
  return {
    date: entry.date,
    rr: entry.rr,
    lastChange: entry.last_change,
    elo: entry.elo,
    tier: entry.tier?.name ?? "Unrated",
    ...(entry.map?.name === undefined ? {} : { mapName: entry.map.name }),
    ...(entry.match_id === undefined ? {} : { matchId: entry.match_id }),
  }
}

export function toDigest(match: CompetitiveStoredMatch): MatchDigest {
  const rounds = Math.max(match.teams.red + match.teams.blue, 1)
  const playerScore = match.stats.team === "Red" ? match.teams.red : match.teams.blue
  const opponentScore = match.stats.team === "Red" ? match.teams.blue : match.teams.red
  const won = playerScore > opponentScore
  const totalShots = match.stats.shots.head + match.stats.shots.body + match.stats.shots.leg
  const acs = Math.round(match.stats.score / rounds)
  const adr = ratio(match.stats.damage.made, rounds, 1)
  const headshotRate = ratio(match.stats.shots.head * 100, totalShots, 1)
  const kdRatio = ratio(match.stats.kills, match.stats.deaths, 2)
  const teamLuck = teamLuckScore({
    acs,
    adr,
    assists: match.stats.assists,
    deaths: match.stats.deaths,
    kills: match.stats.kills,
    won,
  })

  return {
    id: match.meta.id,
    mapName: match.meta.map.name,
    agent: match.stats.character.name,
    mode: match.meta.mode,
    result: won ? "win" : "loss",
    score: `${playerScore}-${opponentScore}`,
    acs,
    kills: match.stats.kills,
    deaths: match.stats.deaths,
    assists: match.stats.assists,
    kdRatio,
    kast: 0,
    adr,
    headshotRate,
    tradeValue: clampPercent((match.stats.assists / rounds) * 100),
    entryImpact: clampPercent((match.stats.kills / rounds) * 100),
    postPlantImpact: clampPercent(
      (match.stats.damage.made / Math.max(match.stats.damage.received, 1)) * 50,
    ),
    teamLuck,
    narrative: `${match.stats.character.name}로 ${match.stats.kills}/${match.stats.deaths}/${match.stats.assists}, ADR ${adr}, HS ${headshotRate}%를 기록했습니다.`,
    startedAt: match.meta.started_at,
    accountLevel: match.stats.level ?? 0,
    rankAtMatch: tierName(match.stats.tier),
  }
}

function applyLatestRrChange(
  matches: readonly MatchDigest[],
  rrDelta: number | undefined,
): readonly MatchDigest[] {
  if (rrDelta === undefined) {
    return matches
  }
  const [latest, ...rest] = matches
  if (latest === undefined) {
    return matches
  }
  return [{ ...latest, rrChange: rrDelta }, ...rest]
}

function isCompetitiveStoredMatch(match: StoredMatchData): match is CompetitiveStoredMatch {
  return (
    match.meta.mode === "Competitive" && (match.stats.team === "Blue" || match.stats.team === "Red")
  )
}

export function providerRegion(account: AccountData, fallback: ValorantRegion): ValorantRegion {
  switch (account.region) {
    case "na":
    case "eu":
    case "kr":
    case "ap":
    case "br":
    case "latam":
      return account.region
    default:
      return fallback
  }
}

function tierName(tier: number | undefined): string {
  if (tier === undefined) {
    return "Unrated"
  }
  return TIER_NAMES[tier] ?? "Unrated"
}

function clampPercent(value: number): number {
  if (value < 0) {
    return 0
  }
  if (value > 100) {
    return 100
  }
  return Math.round(value)
}

function teamLuckScore(input: {
  readonly acs: number
  readonly adr: number
  readonly assists: number
  readonly deaths: number
  readonly kills: number
  readonly won: boolean
}): number {
  const impact = average([
    clampPercent(input.acs / 3),
    clampPercent(input.adr / 1.6),
    clampPercent(ratio(input.kills, input.deaths, 2) * 45),
    clampPercent(input.assists * 8),
  ])
  const outcome = input.won ? 75 : 25
  return clampPercent(50 + (outcome - impact) * 0.8)
}
