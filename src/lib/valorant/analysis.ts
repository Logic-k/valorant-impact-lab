import type { MatchDigest, PentagonScore } from "@/lib/valorant/types"

export function clampScore(value: number): number {
  if (value < 0) {
    return 0
  }
  if (value > 100) {
    return 100
  }
  return Math.round(value)
}

export function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0
  }
  const total = values.reduce((sum, value) => sum + value, 0)
  return Math.round(total / values.length)
}

export function averageDecimal(values: readonly number[], precision: number): number {
  if (values.length === 0) {
    return 0
  }
  const total = values.reduce((sum, value) => sum + value, 0)
  const factor = 10 ** precision
  return Math.round((total / values.length) * factor) / factor
}

export function ratio(numerator: number, denominator: number, precision: number): number {
  if (denominator === 0) {
    return numerator
  }
  const factor = 10 ** precision
  return Math.round((numerator / denominator) * factor) / factor
}

export function winRate(matches: readonly MatchDigest[]): number {
  if (matches.length === 0) {
    return 0
  }
  const wins = matches.filter((match) => match.result === "win").length
  return Math.round((wins / matches.length) * 100)
}

export function teamLuckLabel(score: number): string {
  if (score <= 25) {
    return "극악"
  }
  if (score <= 43) {
    return "나쁨"
  }
  if (score <= 57) {
    return "보통"
  }
  if (score <= 74) {
    return "좋음"
  }
  return "매우 좋음"
}

export function pentagonFromMatches(
  matches: readonly MatchDigest[],
  survivalRate?: number,
): PentagonScore {
  return {
    combat: clampScore(average(matches.map((match) => match.acs)) / 3),
    survival: clampScore(survivalRate ?? average(matches.map((match) => match.kast))),
    utility: clampScore(average(matches.map((match) => match.tradeValue))),
    control: clampScore(average(matches.map((match) => match.postPlantImpact))),
    entry: clampScore(average(matches.map((match) => match.entryImpact))),
  }
}
