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
  return detail.kills.flatMap((kill) => {
    const round = (kill.round ?? 0) + 1
    const event = eventForKill(detail, player.puuid, round, kill)
    return event === undefined ? [] : [event]
  })
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
