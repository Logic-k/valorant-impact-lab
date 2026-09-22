import { describe, expect, it } from "vitest"
import type {
  AccountData,
  MatchDetailData,
  MmrData,
  StoredMatchData,
  StoredMmrHistoryEntry,
} from "@/lib/valorant/providers/henrik-schemas"
import { toProfile, toRankPoint } from "@/lib/valorant/providers/henrik-transform"
import type { PlayerLookup } from "@/lib/valorant/types"

const LOOKUP = {
  name: "땡주의솔큐",
  tag: "가즈아",
  region: "kr",
} satisfies PlayerLookup

const ACCOUNT = {
  account_level: 148,
  name: "땡주의솔큐",
  region: "kr",
  tag: "가즈아",
} satisfies AccountData

const STORED_MATCH = {
  meta: {
    id: "85e40f93-7493-4915-85ac-ec0f517c503e",
    map: { name: "Summit" },
    mode: "Competitive",
    started_at: "2026-07-04T05:09:34.539Z",
  },
  stats: {
    assists: 10,
    character: { name: "Sage" },
    damage: { made: 1613, received: 2270 },
    deaths: 12,
    kills: 9,
    level: 148,
    score: 2642,
    shots: { body: 30, head: 6, leg: 1 },
    team: "Red",
    tier: 9,
  },
  teams: { blue: 8, red: 13 },
} satisfies StoredMatchData

const MMR = {
  current_data: {
    currenttierpatched: "Platinum 3",
    mmr_change_to_last_game: 14,
    ranking_in_tier: 55,
  },
} satisfies MmrData

const MMR_HISTORY_ENTRY = {
  date: "2026-07-03T10:15:00.000Z",
  elo: 1582,
  last_change: 19,
  map: { name: "Ascent" },
  match_id: "m-1",
  rr: 79,
  tier: { name: "Ascendant 1" },
} satisfies StoredMmrHistoryEntry

function detailRound(winningTeam: string, puuid: string, team: string) {
  return {
    player_stats: [
      {
        damage: 140,
        economy: { loadout_value: 2400, remaining: 600, spent: 1800 },
        headshots: 0,
        kills: 1,
        player_puuid: puuid,
        player_team: team,
        score: 320,
      },
    ],
    winning_team: winningTeam,
  }
}

const DETAIL = {
  kills: [],
  metadata: { map: "Summit", matchid: "85e40f93-7493-4915-85ac-ec0f517c503e" },
  players: {
    all_players: [
      { name: "땡주의솔큐", puuid: "p-me", tag: "가즈아", team: "Red" },
      { name: "Enemy", puuid: "p-enemy", tag: "T9", team: "Blue" },
    ],
  },
  rounds: [
    {
      ...detailRound("Red", "p-me", "Red"),
      plant_events: {
        plant_location: { x: -7342, y: 6189 },
        plant_site: "A",
        planted_by: { puuid: "p-me" },
      },
    },
    detailRound("Blue", "p-me", "Red"),
    detailRound("Red", "p-me", "Red"),
  ],
} satisfies MatchDetailData

describe("Henrik stored match transform", () => {
  it("uses real stored match stats instead of placeholder match values", () => {
    const profile = toProfile(LOOKUP, ACCOUNT, MMR, [STORED_MATCH])

    expect(profile.source).toBe("henrik")
    expect(profile.rank).toBe("Platinum 3")
    expect(profile.rr).toBe(55)
    expect(profile.rrDelta).toBe(14)
    expect(profile.summary.matches).toBe(1)
    expect(profile.summary.averageAcs).toBe(126)
    expect(profile.summary.adr).toBe(76.8)
    expect(profile.summary.headshotRate).toBe(16.2)
    expect(profile.summary.kdRatio).toBe(0.75)
    expect(profile.summary.kills).toBe(9)
    expect(profile.recentMatches[0]?.id).toBe("85e40f93-7493-4915-85ac-ec0f517c503e")
    expect(profile.recentMatches[0]?.agent).toBe("Sage")
    expect(profile.recentMatches[0]?.rrChange).toBe(14)
    expect(profile.recentMatches[0]?.teamLuck).toBeGreaterThan(50)
  })

  it("shows the player's team score first when the player is blue", () => {
    const profile = toProfile(LOOKUP, ACCOUNT, null, [
      {
        ...STORED_MATCH,
        stats: {
          ...STORED_MATCH.stats,
          team: "Blue",
        },
        teams: { blue: 13, red: 10 },
      },
    ])

    expect(profile.recentMatches[0]?.result).toBe("win")
    expect(profile.recentMatches[0]?.score).toBe("13-10")
  })

  it("summarizes team luck from the latest eight visible matches", () => {
    const matches = Array.from({ length: 9 }, (_, index) =>
      storedMatchWithDate(index, `2026-07-${String(10 - index).padStart(2, "0")}T05:09:34.539Z`),
    )

    const profile = toProfile(LOOKUP, ACCOUNT, null, matches)
    const latestEightAverage = Math.round(
      profile.recentMatches.slice(0, 8).reduce((sum, match) => sum + match.teamLuck, 0) / 8,
    )

    expect(profile.summary.recentTeamLuck).toBe(latestEightAverage)
    expect(profile.summary.recentTeamLuck).not.toBe(profile.summary.teamLuck)
  })
})

describe("stored MMR history transform", () => {
  it("maps stored-mmr-history entries to rank points", () => {
    const point = toRankPoint(MMR_HISTORY_ENTRY)

    expect(point).toEqual({
      date: "2026-07-03T10:15:00.000Z",
      elo: 1582,
      lastChange: 19,
      mapName: "Ascent",
      matchId: "m-1",
      rr: 79,
      tier: "Ascendant 1",
    })
  })

  it("falls back to Unrated and omits missing optional fields", () => {
    const point = toRankPoint({
      date: "2026-07-01T00:00:00.000Z",
      elo: 900,
      last_change: -8,
      rr: 12,
    })

    expect(point.tier).toBe("Unrated")
    expect(point.mapName).toBeUndefined()
    expect(point.matchId).toBeUndefined()
  })

  it("attaches rank history to the profile", () => {
    const profile = toProfile(LOOKUP, ACCOUNT, MMR, [STORED_MATCH], [], [MMR_HISTORY_ENTRY])

    expect(profile.rankHistory).toHaveLength(1)
    expect(profile.rankHistory[0]?.rr).toBe(79)
    expect(profile.rankHistory[0]?.tier).toBe("Ascendant 1")
  })
})

describe("match detail enrichment", () => {
  it("attaches ordered round outcomes to the matching match card", () => {
    const profile = toProfile(LOOKUP, ACCOUNT, MMR, [STORED_MATCH], [DETAIL])

    expect(profile.recentMatches[0]?.roundOutcomes).toEqual(["win", "loss", "win"])
  })

  it("uses the real KAST rate for summary and the survival axis", () => {
    const profile = toProfile(LOOKUP, ACCOUNT, MMR, [STORED_MATCH], [DETAIL])

    expect(profile.roundDetails.roundsAnalyzed).toBe(3)
    expect(profile.roundDetails.kastRate).toBe(100)
    expect(profile.summary.kast).toBe(100)
    expect(profile.pentagon.survival).toBe(100)
  })

  it("collects plant events into round detail map events", () => {
    const profile = toProfile(LOOKUP, ACCOUNT, MMR, [STORED_MATCH], [DETAIL])
    const plants = profile.roundDetails.mapEvents.filter((event) => event.kind === "plant")

    expect(plants).toHaveLength(1)
    expect(plants[0]).toMatchObject({
      mapName: "Summit",
      matchId: "85e40f93-7493-4915-85ac-ec0f517c503e",
      round: 1,
      x: -7342,
      y: 6189,
    })
  })
})

function storedMatchWithDate(index: number, startedAt: string): StoredMatchData {
  return {
    ...STORED_MATCH,
    meta: {
      ...STORED_MATCH.meta,
      id: `match-${index}`,
      started_at: startedAt,
    },
    stats: {
      ...STORED_MATCH.stats,
      deaths: index === 8 ? 18 : 8,
      kills: index === 8 ? 2 : 20,
      score: index === 8 ? 900 : 4_600,
      team: index === 8 ? "Blue" : "Red",
    },
    teams: index === 8 ? { blue: 13, red: 4 } : { blue: 13, red: 8 },
  }
}
