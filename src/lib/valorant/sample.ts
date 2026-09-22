import { average, pentagonFromMatches, winRate } from "@/lib/valorant/analysis"
import { buildPerformanceInsights } from "@/lib/valorant/performance"
import type { MatchDetailData } from "@/lib/valorant/providers/henrik-schemas"
import { buildRoundDetailInsights } from "@/lib/valorant/round-analysis"
import type { MatchDigest, PlayerLookup, PlayerProfile, RankPoint } from "@/lib/valorant/types"

export const SAMPLE_MATCHES: readonly MatchDigest[] = [
  {
    id: "demo-bind-001",
    mapName: "Bind",
    agent: "Jett",
    mode: "Competitive",
    result: "loss",
    score: "11-13",
    acs: 284,
    kills: 24,
    deaths: 17,
    assists: 4,
    kdRatio: 1.41,
    kast: 72,
    adr: 161,
    headshotRate: 31,
    tradeValue: 66,
    entryImpact: 84,
    postPlantImpact: 48,
    teamLuck: 28,
    narrative:
      "초반 진입과 교전 생산성은 높았지만 후반 post-plant 전환에서 팀 합류가 늦어졌습니다.",
    startedAt: "2026-07-03T12:40:00.000Z",
  },
  {
    id: "demo-ascent-002",
    mapName: "Ascent",
    agent: "Omen",
    mode: "Competitive",
    result: "win",
    score: "13-8",
    acs: 219,
    kills: 17,
    deaths: 13,
    assists: 7,
    kdRatio: 1.31,
    kast: 79,
    adr: 138,
    headshotRate: 27,
    tradeValue: 76,
    entryImpact: 52,
    postPlantImpact: 81,
    teamLuck: 62,
    narrative:
      "연막 유지와 retake 합류가 안정적이어서 낮은 교전량 대비 라운드 영향도가 높았습니다.",
    startedAt: "2026-07-03T10:15:00.000Z",
  },
  {
    id: "demo-lotus-003",
    mapName: "Lotus",
    agent: "Sova",
    mode: "Competitive",
    result: "win",
    score: "13-6",
    acs: 203,
    kills: 14,
    deaths: 10,
    assists: 12,
    kdRatio: 1.4,
    kast: 83,
    adr: 129,
    headshotRate: 24,
    tradeValue: 88,
    entryImpact: 49,
    postPlantImpact: 73,
    teamLuck: 67,
    narrative: "직접 킬보다 스캔 이후 트레이드 연결이 좋았고, 척후대 역할 기대치를 상회했습니다.",
    startedAt: "2026-07-02T21:05:00.000Z",
  },
]

const MOCK_PUUID = "mock-puuid-0001"
const HOTSPOT_A = { x: -7342, y: 6189, site: "A" }
const HOTSPOT_B = { x: -7770, y: -3097, site: "B" }
const HOTSPOT_MID = { x: -4200, y: 1046, site: null }
const ASCENT_HOTSPOTS = [HOTSPOT_A, HOTSPOT_B, HOTSPOT_MID] as const

const ME = { name: "Henrik3", puuid: MOCK_PUUID, tag: "VALO", team: "Blue" as const }
const RED_ANCHOR = {
  name: "Player9",
  puuid: "mock-puuid-0010",
  tag: "T9",
  team: "Red" as const,
}
const MOCK_PLAYERS = [
  ME,
  ...Array.from({ length: 8 }, (_, index) => ({
    name: `Player${index + 1}`,
    puuid: `mock-puuid-${String(index + 2).padStart(4, "0")}`,
    tag: `T${index + 1}`,
    team: index < 4 ? ("Blue" as const) : ("Red" as const),
  })),
  RED_ANCHOR,
]

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

export const MOCK_MATCH_DETAIL: MatchDetailData = buildMockMatchDetail()

function buildMockMatchDetail(): MatchDetailData {
  const rand = seeded(42)
  const kills: MatchDetailData["kills"] = []
  const rounds: MatchDetailData["rounds"] = []

  for (let round = 0; round < 22; round++) {
    const won = rand() > 0.42
    const spot = ASCENT_HOTSPOTS[Math.floor(rand() * ASCENT_HOTSPOTS.length)] ?? HOTSPOT_A
    const jitter = () => (rand() - 0.5) * 2400

    const killsInRound = 3 + Math.floor(rand() * 4)
    for (let k = 0; k < killsInRound; k++) {
      const killerIsPlayer = rand() > 0.78
      const victimIsPlayer = !killerIsPlayer && rand() > 0.82
      const killer = killerIsPlayer ? ME : (MOCK_PLAYERS[1 + Math.floor(rand() * 9)] ?? RED_ANCHOR)
      const victim = victimIsPlayer
        ? ME
        : (MOCK_PLAYERS.find(
            (player) => player.team !== killer.team && player.puuid !== killer.puuid,
          ) ?? RED_ANCHOR)
      kills.push({
        assistants: rand() > 0.7 ? [{ assistant_puuid: ME.puuid }] : [],
        kill_time_in_round: 8000 + Math.floor(rand() * 70000),
        killer_puuid: killer.puuid,
        killer_team: killer.team,
        player_locations_on_kill: [
          {
            location: { x: spot.x + jitter(), y: spot.y + jitter() },
            player_puuid: ME.puuid,
          },
        ],
        round,
        victim_death_location: { x: spot.x + jitter(), y: spot.y + jitter() },
        victim_puuid: victim.puuid,
        victim_team: victim.team,
      })
    }

    rounds.push({
      defuse_events: null,
      plant_events:
        rand() > 0.4
          ? {
              plant_location: { x: spot.x + jitter() * 0.3, y: spot.y + jitter() * 0.3 },
              plant_site: spot.site ?? (rand() > 0.5 ? "A" : "B"),
              planted_by: { puuid: rand() > 0.8 ? MOCK_PUUID : RED_ANCHOR.puuid },
            }
          : null,
      player_stats: MOCK_PLAYERS.map((player) => ({
        damage: Math.floor(rand() * 320),
        economy: {
          armor: { name: rand() > 0.5 ? "Heavy" : "Light" },
          loadout_value: 1200 + Math.floor(rand() * 4200),
          remaining: Math.floor(rand() * 4000),
          spent: Math.floor(rand() * 4500),
          weapon: { name: rand() > 0.3 ? "Vandal" : "Phantom" },
        },
        headshots: Math.floor(rand() * 3),
        kills: player.puuid === MOCK_PUUID ? Math.floor(rand() * 3) : Math.floor(rand() * 2),
        player_puuid: player.puuid,
        player_team: player.team,
        score: Math.floor(rand() * 5200),
      })),
      winning_team: won ? "Blue" : "Red",
    })
  }

  return {
    kills,
    metadata: { map: "Ascent", matchid: "demo-ascent-detail" },
    players: { all_players: MOCK_PLAYERS },
    rounds,
  }
}

export const SAMPLE_RANK_HISTORY: readonly RankPoint[] = [
  {
    date: "2026-07-01T20:12:00.000Z",
    elo: 1540,
    lastChange: 16,
    mapName: "Bind",
    rr: 34,
    tier: "Ascendant 1",
  },
  {
    date: "2026-07-02T09:40:00.000Z",
    elo: 1556,
    lastChange: 18,
    mapName: "Lotus",
    rr: 52,
    tier: "Ascendant 1",
  },
  {
    date: "2026-07-02T21:05:00.000Z",
    elo: 1574,
    lastChange: -14,
    mapName: "Ascent",
    rr: 38,
    tier: "Ascendant 1",
  },
  {
    date: "2026-07-03T08:30:00.000Z",
    elo: 1560,
    lastChange: 22,
    mapName: "Ascent",
    rr: 60,
    tier: "Ascendant 1",
  },
  {
    date: "2026-07-03T10:15:00.000Z",
    elo: 1582,
    lastChange: 19,
    mapName: "Bind",
    rr: 79,
    tier: "Ascendant 1",
  },
  {
    date: "2026-07-03T12:40:00.000Z",
    elo: 1601,
    lastChange: -15,
    mapName: "Ascent",
    rr: 64,
    tier: "Ascendant 2",
  },
]

export function buildMockProfile(lookup: PlayerLookup): PlayerProfile {
  const roundDetails = buildRoundDetailInsights(
    { name: "Henrik3", tag: "VALO", region: lookup.region },
    [MOCK_MATCH_DETAIL],
  )
  const outcomes = MOCK_MATCH_DETAIL.rounds.map((round) =>
    round.winning_team === "Blue" ? ("win" as const) : ("loss" as const),
  )
  const matches = SAMPLE_MATCHES.map((match) =>
    match.id === "demo-ascent-002" ? { ...match, roundOutcomes: outcomes } : match,
  )
  return {
    displayName: lookup.name,
    tag: lookup.tag,
    region: lookup.region,
    accountLevel: 184,
    rank: "Ascendant 2",
    rr: 64,
    source: "mock",
    sourceLabel: "Mock fixture",
    consentState: "demo",
    summary: {
      matches: matches.length,
      winRate: winRate(matches),
      averageAcs: average(matches.map((match) => match.acs)),
      kills: matches.reduce((sum, match) => sum + match.kills, 0),
      deaths: matches.reduce((sum, match) => sum + match.deaths, 0),
      assists: matches.reduce((sum, match) => sum + match.assists, 0),
      kdRatio: 1.37,
      kast: roundDetails.kastRate,
      adr: average(matches.map((match) => match.adr)),
      headshotRate: average(matches.map((match) => match.headshotRate)),
      teamLuck: average(matches.map((match) => match.teamLuck)),
      recentTeamLuck: average(matches.slice(0, 8).map((match) => match.teamLuck)),
    },
    pentagon: pentagonFromMatches(matches, roundDetails.kastRate),
    insights: buildPerformanceInsights(matches, {
      storedMatches: matches.length,
      competitiveMatches: matches.length,
    }),
    roundDetails,
    recentMatches: matches,
    rankHistory: SAMPLE_RANK_HISTORY,
  }
}
