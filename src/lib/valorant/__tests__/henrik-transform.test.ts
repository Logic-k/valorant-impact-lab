import { describe, expect, it } from "vitest"
import type { AccountData, MmrData, StoredMatchData } from "@/lib/valorant/providers/henrik-schemas"
import { toProfile } from "@/lib/valorant/providers/henrik-transform"
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
