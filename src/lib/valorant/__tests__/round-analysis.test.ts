import { describe, expect, it } from "vitest"
import { buildRoundDetailInsights } from "@/lib/valorant/round-analysis"

const DETAIL = {
  metadata: { game_start: 1783176771, map: "Ascent", matchid: "match-1" },
  players: {
    all_players: [
      { puuid: "player-1", name: "땡주는바멍이래요", tag: "KR1", team: "Red" },
      { puuid: "ally-1", name: "ally", tag: "KR1", team: "Red" },
      { puuid: "enemy-1", name: "enemy", tag: "KR1", team: "Blue" },
      { puuid: "enemy-2", name: "enemy2", tag: "KR1", team: "Blue" },
    ],
  },
  rounds: [
    {
      winning_team: "Red",
      player_stats: [
        {
          player_puuid: "player-1",
          player_team: "Red",
          score: 250,
          kills: 1,
          damage: 150,
          headshots: 1,
          bodyshots: 3,
          legshots: 0,
          economy: {
            loadout_value: 3900,
            spent: 2900,
            remaining: 1000,
            weapon: { name: "Vandal" },
            armor: { name: "Heavy Armor" },
          },
        },
      ],
    },
    {
      winning_team: "Red",
      player_stats: [
        {
          player_puuid: "player-1",
          player_team: "Red",
          score: 40,
          kills: 0,
          damage: 40,
          headshots: 0,
          bodyshots: 1,
          legshots: 0,
          economy: {
            loadout_value: 800,
            spent: 800,
            remaining: 0,
            weapon: { name: "Classic" },
            armor: { name: null },
          },
        },
      ],
    },
    {
      winning_team: "Blue",
      player_stats: [
        {
          player_puuid: "player-1",
          player_team: "Red",
          score: 420,
          kills: 2,
          damage: 280,
          headshots: 2,
          bodyshots: 5,
          legshots: 0,
          economy: {
            loadout_value: 4700,
            spent: 3900,
            remaining: 600,
            weapon: { name: "Vandal" },
            armor: { name: "Heavy Armor" },
          },
        },
      ],
    },
  ],
  kills: [
    {
      round: 0,
      kill_time_in_round: 10_000,
      killer_puuid: "enemy-1",
      killer_team: "Blue",
      victim_puuid: "ally-1",
      victim_team: "Red",
      victim_death_location: { x: 800, y: -1800 },
      player_locations_on_kill: [],
      assistants: [],
    },
    {
      round: 0,
      kill_time_in_round: 40_000,
      killer_puuid: "player-1",
      killer_team: "Red",
      victim_puuid: "enemy-1",
      victim_team: "Blue",
      victim_death_location: { x: 1000, y: -2000 },
      player_locations_on_kill: [{ player_puuid: "player-1", location: { x: 900, y: -1900 } }],
      assistants: [],
    },
    {
      round: 1,
      kill_time_in_round: 30_000,
      killer_puuid: "enemy-1",
      killer_team: "Blue",
      victim_puuid: "player-1",
      victim_team: "Red",
      victim_death_location: { x: 2000, y: -3000 },
      player_locations_on_kill: [{ player_puuid: "player-1", location: { x: 2000, y: -3000 } }],
      assistants: [],
    },
    {
      round: 1,
      kill_time_in_round: 33_000,
      killer_puuid: "ally-1",
      killer_team: "Red",
      victim_puuid: "enemy-1",
      victim_team: "Blue",
      victim_death_location: { x: 2100, y: -3100 },
      player_locations_on_kill: [],
      assistants: [],
    },
    {
      round: 2,
      kill_time_in_round: 8_000,
      killer_puuid: "player-1",
      killer_team: "Red",
      victim_puuid: "enemy-1",
      victim_team: "Blue",
      victim_death_location: { x: 3000, y: -4100 },
      player_locations_on_kill: [{ player_puuid: "player-1", location: { x: 2900, y: -4000 } }],
      assistants: [],
    },
    {
      round: 2,
      kill_time_in_round: 20_000,
      killer_puuid: "enemy-2",
      killer_team: "Blue",
      victim_puuid: "player-1",
      victim_team: "Red",
      victim_death_location: { x: 3200, y: -4300 },
      player_locations_on_kill: [{ player_puuid: "player-1", location: { x: 3200, y: -4300 } }],
      assistants: [],
    },
  ],
}

describe("round detail analysis", () => {
  it("derives review-worthy round signals from match detail data", () => {
    const insights = buildRoundDetailInsights(
      { name: "땡주는바멍이래요", tag: "KR1", region: "kr" },
      [DETAIL],
    )

    expect(insights.matchesAnalyzed).toBe(1)
    expect(insights.roundsAnalyzed).toBe(3)
    expect(insights.kastRate).toBe(100)
    expect(insights.survivalRate).toBe(33)
    expect(insights.tradeRate).toBe(33)
    expect(insights.clutchAttempts).toBe(1)
    expect(insights.clutchWins).toBe(1)
    expect(insights.firstBloods).toBe(1)
    expect(insights.firstDeaths).toBe(1)
    expect(insights.untradedDeaths).toBe(1)
    expect(insights.highImpactLosses).toBe(1)
    expect(insights.lowImpactWins).toBe(1)
    expect(insights.matchReports).toHaveLength(1)
    expect(insights.matchReports[0]?.rounds).toHaveLength(3)
    expect(insights.matchReports[0]?.startedAt).toBe("2026-07-04T14:52:51.000Z")
    expect(insights.rounds[0]?.startedAt).toBe("2026-07-04T14:52:51.000Z")
    expect(insights.matchReports[0]?.highPriorityRounds).toBe(1)
    expect(insights.matchReports[0]?.kills).toBe(3)
    expect(insights.matchReports[0]?.damage).toBe(470)
    expect(insights.matchReports[0]?.kastRate).toBe(100)
    expect(insights.matchReports[0]?.averageContributionScore).toBe(440)
    expect(insights.matchReports[0]?.impactLabel).toBe("강한 기여")
    expect(insights.matchReports[0]?.summary).toContain("3라운드 중 3라운드 KAST")
    expect(insights.rounds[1]?.traded).toBe(true)
    expect(insights.rounds[2]?.reviewPriority).toBe("high")
    expect(insights.rounds[2]?.evidence).toContain("2킬 280딜 후 패배")
    expect(insights.rounds[2]?.timeline.map((event) => event.text)).toEqual([
      "첫 교전: 본인 -> enemy#KR1",
      "본인 킬: enemy#KR1",
      "본인 사망: enemy2#KR1에게 사망",
    ])
    expect(insights.rounds[2]?.timeline.map((event) => event.timeLabel)).toEqual([
      "00:08",
      "00:08",
      "00:20",
    ])
    expect(insights.reviewRounds[0]?.round).toBe(3)
  })
})
