import type { MatchDetailData } from "@/lib/valorant/providers/henrik-schemas"
import type { PlayerLookup, RoundMapEvent } from "@/lib/valorant/types"

export function eventsForDetail(
  lookup: PlayerLookup,
  detail: MatchDetailData,
): readonly RoundMapEvent[] {
  const player = findPlayer(lookup, detail)
  if (player === undefined) {
    return []
  }
  const killEvents = detail.kills.flatMap((kill) => {
    const round = (kill.round ?? 0) + 1
    const event = eventForKill(detail, player.puuid, round, kill)
    return event === undefined ? [] : [event]
  })
  const spikeEvents = detail.rounds.flatMap((round, index) =>
    spikeEventsForRound(detail, player.puuid, index + 1, round),
  )
  return [...killEvents, ...spikeEvents]
}

function spikeEventsForRound(
  detail: MatchDetailData,
  puuid: string,
  roundNumber: number,
  round: MatchDetailData["rounds"][number],
): readonly RoundMapEvent[] {
  const events: RoundMapEvent[] = []
  const plant = round.plant_events
  if (plant?.plant_location != null) {
    const site = plant.plant_site == null ? "" : ` ${plant.plant_site}`
    const mine = plant.planted_by?.puuid === puuid
    events.push(
      mapEvent(
        detail,
        roundNumber,
        "plant",
        plant.plant_location,
        `R${roundNumber} Plant${site}${mine ? " (본인)" : ""}`,
      ),
    )
  }
  const defuse = round.defuse_events
  if (defuse?.defuse_location != null) {
    const mine = defuse.defused_by?.puuid === puuid
    events.push(
      mapEvent(
        detail,
        roundNumber,
        "defuse",
        defuse.defuse_location,
        `R${roundNumber} Defuse${mine ? " (본인)" : ""}`,
      ),
    )
  }
  return events
}

function eventForKill(
  detail: MatchDetailData,
  puuid: string,
  round: number,
  kill: MatchDetailData["kills"][number],
): RoundMapEvent | undefined {
  const playerLocation = kill.player_locations_on_kill.find(
    (location) => location.player_puuid === puuid,
  )
  if (kill.killer_puuid === puuid && kill.victim_death_location !== undefined) {
    return mapEvent(detail, round, "kill", kill.victim_death_location, `R${round} Kill`)
  }
  if (kill.victim_puuid === puuid && kill.victim_death_location !== undefined) {
    return mapEvent(detail, round, "death", kill.victim_death_location, `R${round} Death`)
  }
  if (assisted(kill.assistants, puuid) && playerLocation !== undefined) {
    return mapEvent(detail, round, "assist", playerLocation.location, `R${round} Assist`)
  }
  return undefined
}

function mapEvent(
  detail: MatchDetailData,
  round: number,
  kind: RoundMapEvent["kind"],
  location: { readonly x: number; readonly y: number },
  label: string,
): RoundMapEvent {
  return {
    matchId: matchId(detail),
    mapName: detail.metadata.map,
    round,
    kind,
    x: location.x,
    y: location.y,
    label,
  }
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

function matchId(detail: MatchDetailData): string {
  return detail.metadata.matchid ?? detail.metadata.match_id ?? "unknown-match"
}
