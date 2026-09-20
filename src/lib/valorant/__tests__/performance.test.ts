import { describe, expect, it } from "vitest"
import { buildPerformanceInsights } from "@/lib/valorant/performance"
import type { MatchDigest } from "@/lib/valorant/types"

const MATCHES = [
  match({
    agent: "Sova",
    mapName: "Ascent",
    result: "win",
    acs: 220,
    kills: 18,
    deaths: 12,
    assists: 8,
  }),
  match({
    agent: "Sova",
    mapName: "Bind",
    result: "loss",
    acs: 180,
    kills: 12,
    deaths: 14,
    assists: 10,
  }),
  match({
    agent: "Iso",
    mapName: "Ascent",
    result: "win",
    acs: 260,
    kills: 21,
    deaths: 15,
    assists: 3,
    startedAt: "2026-06-24T05:09:34.539Z",
  }),
] satisfies readonly MatchDigest[]

describe("performance insights", () => {
  it("aggregates practical contribution signals by agent, map, and period", () => {
    const insights = buildPerformanceInsights(MATCHES, {
      storedMatches: 4,
      competitiveMatches: 3,
    })

    expect(insights.coverage.storedMatches).toBe(4)
    expect(insights.coverage.competitiveMatches).toBe(3)
    expect(insights.impactScore).toBeGreaterThan(0)
    expect(insights.agentBreakdown[0]?.name).toBe("Sova")
    expect(insights.agentBreakdown[0]?.matches).toBe(2)
    expect(insights.mapBreakdown[0]?.name).toBe("Ascent")
    expect(insights.mapBreakdown[0]?.winRate).toBe(100)
    expect(insights.periodBreakdown[0]?.name).toBe("2026-07")
    expect(insights.periodBreakdown[0]?.dateRange).toBe("2026-07-04")
    expect(insights.periodBreakdown[1]?.name).toBe("2026-06")
    expect(insights.strengths.length).toBeGreaterThan(0)
  })

  it("surfaces practical risk notes when contribution signals are weak", () => {
    const insights = buildPerformanceInsights(
      [
        match({
          result: "loss",
          acs: 120,
          kills: 7,
          deaths: 17,
          assists: 1,
          adr: 82,
        }),
      ],
      { storedMatches: 1, competitiveMatches: 1 },
    )

    expect(insights.risks.length).toBeGreaterThan(0)
  })
})

function match(overrides: Partial<MatchDigest>): MatchDigest {
  return {
    id: crypto.randomUUID(),
    mapName: "Ascent",
    agent: "Sova",
    mode: "Competitive",
    result: "win",
    score: "13-9",
    acs: 200,
    kills: 15,
    deaths: 14,
    assists: 6,
    kdRatio: 1.07,
    kast: 0,
    adr: 130,
    headshotRate: 18,
    tradeValue: 40,
    entryImpact: 60,
    postPlantImpact: 55,
    teamLuck: 50,
    narrative: "fixture",
    startedAt: "2026-07-04T05:09:34.539Z",
    ...overrides,
  }
}
