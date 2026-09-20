import { describe, expect, it } from "vitest"

import {
  average,
  clampScore,
  pentagonFromMatches,
  teamLuckLabel,
  winRate,
} from "@/lib/valorant/analysis"
import { SAMPLE_MATCHES } from "@/lib/valorant/sample"

describe("analysis metrics", () => {
  it("clamps scores when provider values are outside display bounds", () => {
    const low = clampScore(-12)
    const high = clampScore(148)
    const middle = clampScore(64.4)

    expect(low).toBe(0)
    expect(high).toBe(100)
    expect(middle).toBe(64)
  })

  it("returns zero averages when no matches are available", () => {
    const result = average([])

    expect(result).toBe(0)
  })

  it("calculates win rate from match outcomes", () => {
    const result = winRate(SAMPLE_MATCHES)

    expect(result).toBe(67)
  })

  it("labels team luck into narrative buckets", () => {
    expect(teamLuckLabel(22)).toBe("극악")
    expect(teamLuckLabel(50)).toBe("보통")
    expect(teamLuckLabel(82)).toBe("매우 좋음")
  })

  it("builds bounded pentagon scores from recent matches", () => {
    const result = pentagonFromMatches(SAMPLE_MATCHES)

    expect(result.combat).toBeGreaterThan(0)
    expect(result.entry).toBeLessThanOrEqual(100)
    expect(result.control).toBeLessThanOrEqual(100)
  })
})
