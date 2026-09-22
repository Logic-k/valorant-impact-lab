import type { MatchDetailData } from "@/lib/valorant/providers/henrik-schemas"
import type { BuyType, OpeningTeam } from "@/lib/valorant/types"

export const TRADE_WINDOW_MS = 3_000
export const TRADE_DISTANCE_UNITS = 3_000

export const ECO_LOADOUT_MAX = 1_500
export const FULL_BUY_LOADOUT = 3_900

type KillEvent = MatchDetailData["kills"][number]
type RoundData = MatchDetailData["rounds"][number]
type Location = { readonly x: number; readonly y: number }

export function findTrade(kills: readonly KillEvent[], death: KillEvent): KillEvent | undefined {
  return kills.find(
    (kill) =>
      kill.killer_team === death.victim_team &&
      kill.victim_puuid === death.killer_puuid &&
      kill.kill_time_in_round > death.kill_time_in_round &&
      kill.kill_time_in_round - death.kill_time_in_round <= TRADE_WINDOW_MS &&
      withinTradeDistance(death, kill.killer_puuid),
  )
}

export function hasTradeableAlly(
  death: KillEvent,
  alivePuuids: ReadonlySet<string>,
  allyPuuids: ReadonlySet<string>,
): boolean {
  return death.player_locations_on_kill.some(
    (entry) =>
      entry.player_puuid !== death.victim_puuid &&
      allyPuuids.has(entry.player_puuid) &&
      alivePuuids.has(entry.player_puuid) &&
      withinTradeDistance(death, entry.player_puuid),
  )
}

function withinTradeDistance(death: KillEvent, allyPuuid: string): boolean {
  const victimLocation = death.victim_death_location
  const ally = death.player_locations_on_kill.find((entry) => entry.player_puuid === allyPuuid)
  if (victimLocation === undefined || ally === undefined) {
    return true
  }
  return distance(victimLocation, ally.location) <= TRADE_DISTANCE_UNITS
}

function distance(left: Location, right: Location): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

export function openingTeam(kills: readonly KillEvent[], playerTeam: string): OpeningTeam {
  const first = kills[0]
  if (first === undefined) {
    return "none"
  }
  return first.killer_team === playerTeam ? "own" : "enemy"
}

export function alivePlayersBefore(
  detail: MatchDetailData,
  kills: readonly KillEvent[],
  timeMs: number,
): ReadonlySet<string> {
  const alive = new Set(detail.players.all_players.map((player) => player.puuid))
  for (const kill of kills) {
    if (kill.kill_time_in_round < timeMs) {
      alive.delete(kill.victim_puuid)
    }
  }
  return alive
}

export function clutchSize(
  detail: MatchDetailData,
  kills: readonly KillEvent[],
  puuid: string,
  playerTeam: string,
): number {
  const alive = new Set(detail.players.all_players.map((player) => player.puuid))
  const teamOf = new Map(detail.players.all_players.map((player) => [player.puuid, player.team]))
  const count = (team: string, isOwn: boolean) =>
    [...alive].filter((entry) => (teamOf.get(entry) === team) === isOwn).length
  const check = () => {
    const own = count(playerTeam, true)
    const enemies = count(playerTeam, false)
    return own === 1 && alive.has(puuid) && enemies > 0 ? enemies : 0
  }
  for (const kill of kills) {
    const size = check()
    if (size > 0) {
      return size
    }
    if (kill.victim_puuid === puuid) {
      return 0
    }
    alive.delete(kill.victim_puuid)
  }
  return check()
}

export function teamLoadoutAverage(round: RoundData, team: string): number {
  const stats = round.player_stats.filter((entry) => entry.player_team === team)
  if (stats.length === 0) {
    return 0
  }
  const total = stats.reduce((sum, entry) => sum + entry.economy.loadout_value, 0)
  return Math.round(total / stats.length)
}

export function buyTypeFor(averageLoadout: number): BuyType {
  if (averageLoadout < ECO_LOADOUT_MAX) {
    return "eco"
  }
  if (averageLoadout < FULL_BUY_LOADOUT) {
    return "semi"
  }
  return "full"
}

export function econRating(damage: number, loadoutValue: number): number {
  if (loadoutValue <= 0) {
    return 0
  }
  return Math.round((damage / loadoutValue) * 1000)
}
