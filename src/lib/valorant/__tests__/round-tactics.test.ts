import { describe, expect, it } from "vitest"
import type { MatchDetailData } from "@/lib/valorant/providers/henrik-schemas"
import { buyTypeFor, econRating, findTrade, hasTradeableAlly } from "@/lib/valorant/round-tactics"

type KillEvent = MatchDetailData["kills"][number]

function kill(overrides: Partial<KillEvent>): KillEvent {
  return {
    round: 0,
    kill_time_in_round: 0,
    killer_puuid: "enemy-1",
    killer_team: "Blue",
    victim_puuid: "player-1",
    victim_team: "Red",
    victim_death_location: { x: 0, y: 0 },
    player_locations_on_kill: [],
    assistants: [],
    ...overrides,
  }
}

const DEATH = kill({
  kill_time_in_round: 10_000,
  player_locations_on_kill: [
    { player_puuid: "ally-near", location: { x: 1_000, y: 1_000 } },
    { player_puuid: "ally-far", location: { x: 5_000, y: 5_000 } },
  ],
})

function revenge(by: string, at: number): KillEvent {
  return kill({
    kill_time_in_round: at,
    killer_puuid: by,
    killer_team: "Red",
    victim_puuid: "enemy-1",
    victim_team: "Blue",
  })
}

describe("trade judgement", () => {
  it("counts a trade within 3 seconds by a nearby ally", () => {
    expect(findTrade([DEATH, revenge("ally-near", 13_000)], DEATH)).toBeDefined()
  })

  it("rejects trades outside the 3 second window", () => {
    expect(findTrade([DEATH, revenge("ally-near", 13_001)], DEATH)).toBeUndefined()
  })

  it("rejects trades from allies farther than 3000 units at time of death", () => {
    expect(findTrade([DEATH, revenge("ally-far", 12_000)], DEATH)).toBeUndefined()
  })

  it("falls back to time-only when the trader has no location snapshot", () => {
    expect(findTrade([DEATH, revenge("ally-unknown", 12_000)], DEATH)).toBeDefined()
  })

  it("flags untraded deaths with a living ally in trade range", () => {
    const allies = new Set(["ally-near", "ally-far"])
    expect(hasTradeableAlly(DEATH, new Set(["ally-near", "ally-far"]), allies)).toBe(true)
    expect(hasTradeableAlly(DEATH, new Set(["ally-far"]), allies)).toBe(false)
  })
})

describe("economy classification", () => {
  it("classifies buy types from average team loadout", () => {
    expect(buyTypeFor(800)).toBe("eco")
    expect(buyTypeFor(2_400)).toBe("semi")
    expect(buyTypeFor(3_900)).toBe("full")
  })

  it("scores damage per 1000 credits of loadout", () => {
    expect(econRating(150, 3_900)).toBe(38)
    expect(econRating(150, 0)).toBe(0)
  })
})
