import type { MatchDetailData } from "@/lib/valorant/providers/henrik-schemas"
import type { RoundReport, RoundTimelineEvent } from "@/lib/valorant/types"

const TRADE_WINDOW_MS = 5_000

type KillEvent = MatchDetailData["kills"][number]

type TimelineInput = {
  readonly detail: MatchDetailData
  readonly playerPuuid: string
  readonly kills: readonly KillEvent[]
}

type EvidenceInput = {
  readonly kills: number
  readonly damage: number
  readonly result: RoundReport["result"]
  readonly survived: boolean
  readonly traded: boolean
  readonly firstBlood: boolean
  readonly firstDeath: boolean
  readonly untradedDeath: boolean
  readonly spent: number
  readonly reviewReason: string
}

export function buildRoundTimeline(input: TimelineInput): readonly RoundTimelineEvent[] {
  const opening = input.kills[0]
  const death = input.kills.find((kill) => kill.victim_puuid === input.playerPuuid)
  const events = [
    ...(opening === undefined ? [] : [openingEvent(input.detail, input.playerPuuid, opening)]),
    ...input.kills.flatMap((kill) => personalEvents(input.detail, input.playerPuuid, kill)),
    ...(death === undefined
      ? []
      : tradeEvents(input.detail, input.playerPuuid, input.kills, death)),
  ]
  return events.sort(
    (left, right) => left.timeMs - right.timeMs || eventOrder(left) - eventOrder(right),
  )
}

export function buildRoundEvidence(input: EvidenceInput): readonly string[] {
  const resultLabel = input.result === "win" ? "승리" : "패배"
  const evidence = [`${input.kills}킬 ${input.damage}딜 후 ${resultLabel}`]
  if (input.firstBlood) {
    evidence.push("라운드 첫 킬로 선제 개입")
  }
  if (input.firstDeath) {
    evidence.push("라운드 첫 사망")
  }
  if (input.untradedDeath) {
    evidence.push("사망 후 5초 내 교환 없음")
  }
  if (!input.survived && input.traded) {
    evidence.push("사망 후 5초 내 교환 성공")
  }
  if (!input.survived && input.spent >= 3000) {
    evidence.push(`고비용 장비 손실 ${input.spent}`)
  }
  evidence.push(`판단 사유: ${input.reviewReason}`)
  return evidence
}

function openingEvent(
  detail: MatchDetailData,
  playerPuuid: string,
  kill: KillEvent,
): RoundTimelineEvent {
  return event(
    kill.kill_time_in_round,
    "opening",
    `첫 교전: ${nameFor(detail, playerPuuid, kill.killer_puuid)} -> ${nameFor(
      detail,
      playerPuuid,
      kill.victim_puuid,
    )}`,
    kill.killer_puuid === playerPuuid || kill.victim_puuid === playerPuuid,
  )
}

function personalEvents(
  detail: MatchDetailData,
  playerPuuid: string,
  kill: KillEvent,
): readonly RoundTimelineEvent[] {
  if (kill.killer_puuid === playerPuuid) {
    return [
      event(
        kill.kill_time_in_round,
        "kill",
        `본인 킬: ${nameFor(detail, playerPuuid, kill.victim_puuid)}`,
        true,
      ),
    ]
  }
  if (kill.victim_puuid === playerPuuid) {
    return [
      event(
        kill.kill_time_in_round,
        "death",
        `본인 사망: ${nameFor(detail, playerPuuid, kill.killer_puuid)}에게 사망`,
        true,
      ),
    ]
  }
  if (assisted(kill.assistants, playerPuuid)) {
    return [
      event(
        kill.kill_time_in_round,
        "assist",
        `본인 어시스트: ${nameFor(detail, playerPuuid, kill.victim_puuid)} 처치 관여`,
        true,
      ),
    ]
  }
  return []
}

function tradeEvents(
  detail: MatchDetailData,
  playerPuuid: string,
  kills: readonly KillEvent[],
  death: KillEvent,
): readonly RoundTimelineEvent[] {
  const trade = kills.find(
    (kill) =>
      kill.killer_team === death.victim_team &&
      kill.victim_puuid === death.killer_puuid &&
      kill.kill_time_in_round > death.kill_time_in_round &&
      kill.kill_time_in_round - death.kill_time_in_round <= TRADE_WINDOW_MS,
  )
  if (trade === undefined) {
    return []
  }
  return [
    event(
      trade.kill_time_in_round,
      "trade",
      `교환 성공: ${nameFor(detail, playerPuuid, trade.killer_puuid)} -> ${nameFor(
        detail,
        playerPuuid,
        trade.victim_puuid,
      )}`,
      true,
    ),
  ]
}

function event(
  timeMs: number,
  kind: RoundTimelineEvent["kind"],
  text: string,
  emphasis: boolean,
): RoundTimelineEvent {
  return { timeMs, timeLabel: timeLabel(timeMs), kind, text, emphasis }
}

function nameFor(detail: MatchDetailData, playerPuuid: string, puuid: string): string {
  if (puuid === playerPuuid) {
    return "본인"
  }
  const player = detail.players.all_players.find((entry) => entry.puuid === puuid)
  if (player === undefined) {
    return "Unknown"
  }
  return `${player.name}#${player.tag}`
}

function assisted(
  assistants: readonly {
    readonly assistant_puuid?: string | undefined
    readonly puuid?: string | undefined
  }[],
  puuid: string,
): boolean {
  return assistants.some(
    (assistant) => assistant.assistant_puuid === puuid || assistant.puuid === puuid,
  )
}

function timeLabel(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
}

function eventOrder(event: RoundTimelineEvent): number {
  switch (event.kind) {
    case "opening":
      return 0
    case "kill":
      return 1
    case "assist":
      return 2
    case "death":
      return 3
    case "trade":
      return 4
    case "note":
      return 5
  }
}
