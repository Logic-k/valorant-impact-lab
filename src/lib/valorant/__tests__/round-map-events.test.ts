import { describe, expect, it } from "vitest"
import type { MatchDetailData } from "@/lib/valorant/providers/henrik-schemas"
import { eventsForDetail } from "@/lib/valorant/round-map-events"
import type { PlayerLookup } from "@/lib/valorant/types"

const LOOKUP = { name: "Player", tag: "T1", region: "kr" } satisfies PlayerLookup

function playerStats(puuid: string, team: string) {
  return {
    damage: 120,
    economy: { loadout_value: 2000, remaining: 500, spent: 1500 },
    headshots: 0,
    kills: 1,
    player_puuid: puuid,
    player_team: team,
    score: 300,
  }
}

const DETAIL = {
  kills: [
    {
      assistants: [],
      kill_time_in_round: 5000,
      killer_puuid: "p-me",
      killer_team: "Blue",
      player_locations_on_kill: [{ location: { x: -4000, y: 1000 }, player_puuid: "p-me" }],
      round: 0,
      victim_death_location: { x: -7300, y: 6000 },
      victim_puuid: "p-enemy",
      victim_team: "Red",
    },
    {
      assistants: [],
      kill_time_in_round: 30000,
      killer_puuid: "p-enemy",
      killer_team: "Red",
      player_locations_on_kill: [],
      round: 1,
      victim_death_location: { x: -5000, y: 500 },
      victim_puuid: "p-me",
      victim_team: "Blue",
    },
    {
      assistants: [{ assistant_puuid: "p-me" }],
      kill_time_in_round: 45000,
      killer_puuid: "p-ally",
      killer_team: "Blue",
      player_locations_on_kill: [{ location: { x: -6000, y: 2000 }, player_puuid: "p-me" }],
      round: 1,
      victim_death_location: { x: -6100, y: 2100 },
      victim_puuid: "p-enemy",
      victim_team: "Red",
    },
    {
      assistants: [],
      kill_time_in_round: 60000,
      killer_puuid: "p-enemy",
      killer_team: "Red",
      player_locations_on_kill: [],
      round: 2,
      victim_death_location: { x: -7000, y: -3000 },
      victim_puuid: "p-ally",
      victim_team: "Blue",
    },
  ],
  metadata: { map: "Ascent", matchid: "match-evt-1" },
  players: {
    all_players: [
      { name: "Player", puuid: "p-me", tag: "T1", team: "Blue" },
      { name: "Ally", puuid: "p-ally", tag: "T2", team: "Blue" },
      { name: "Enemy", puuid: "p-enemy", tag: "T3", team: "Red" },
    ],
  },
  rounds: [
    {
      defuse_events: null,
      plant_events: {
        plant_location: { x: -7342, y: 6189 },
        plant_site: "A",
        planted_by: { puuid: "p-me" },
      },
      player_stats: [playerStats("p-me", "Blue")],
      winning_team: "Blue",
    },
    {
      defuse_events: {
        defuse_location: { x: -7770, y: -3000 },
        defused_by: { puuid: "p-me" },
      },
      plant_events: {
        plant_location: { x: -7770, y: -3097 },
        plant_site: "B",
        planted_by: { puuid: "p-enemy" },
      },
      player_stats: [playerStats("p-me", "Blue")],
      winning_team: "Blue",
    },
    {
      defuse_events: null,
      plant_events: { plant_location: null, plant_site: null, planted_by: null },
      player_stats: [playerStats("p-me", "Blue")],
      winning_team: "Red",
    },
  ],
} satisfies MatchDetailData

describe("eventsForDetail", () => {
  it("emits kill, death, and assist events at the right coordinates", () => {
    const events = eventsForDetail(LOOKUP, DETAIL)

    const kill = events.find((event) => event.kind === "kill")
    expect(kill).toMatchObject({
      mapName: "Ascent",
      matchId: "match-evt-1",
      round: 1,
      x: -7300,
      y: 6000,
    })

    const death = events.find((event) => event.kind === "death")
    expect(death).toMatchObject({ round: 2, x: -5000, y: 500 })

    const assist = events.find((event) => event.kind === "assist")
    expect(assist).toMatchObject({ round: 2, x: -6000, y: 2000 })
  })

  it("skips kills the player was not involved in", () => {
    const events = eventsForDetail(LOOKUP, DETAIL)
    const roundThreeEvents = events.filter(
      (event) => event.round === 3 && (event.kind === "kill" || event.kind === "death"),
    )

    expect(roundThreeEvents).toHaveLength(0)
    expect(events.filter((event) => event.kind === "kill")).toHaveLength(1)
  })

  it("emits plant and defuse events with site and ownership labels", () => {
    const events = eventsForDetail(LOOKUP, DETAIL)
    const plants = events.filter((event) => event.kind === "plant")
    const defuses = events.filter((event) => event.kind === "defuse")

    expect(plants).toHaveLength(2)
    expect(plants[0]).toMatchObject({ round: 1, x: -7342, y: 6189, label: "R1 Plant A (본인)" })
    expect(plants[1]).toMatchObject({ round: 2, label: "R2 Plant B" })
    expect(defuses).toHaveLength(1)
    expect(defuses[0]).toMatchObject({ round: 2, x: -7770, y: -3000, label: "R2 Defuse (본인)" })
  })

  it("skips spike events without a location", () => {
    const events = eventsForDetail(LOOKUP, DETAIL)

    expect(events.filter((event) => event.round === 3)).toHaveLength(0)
  })

  it("returns no events when the player is not in the match", () => {
    const events = eventsForDetail({ name: "Ghost", tag: "T9", region: "kr" }, DETAIL)

    expect(events).toHaveLength(0)
  })
})
