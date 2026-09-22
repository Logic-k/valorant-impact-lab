import { describe, expect, it } from "vitest"
import { agentAssetFor, gameToMapFraction, type MapAsset, mapAssetFor } from "@/lib/valorant/assets"

const ASCENT = {
  name: "Ascent",
  xMultiplier: 0.00007,
  xScalarToAdd: 0.813895,
  yMultiplier: -0.00007,
  yScalarToAdd: 0.573242,
} satisfies MapAsset

describe("gameToMapFraction", () => {
  it("places the Ascent A site plant zone inside the site area", () => {
    const { u, v } = gameToMapFraction(ASCENT, -7342, 6189)

    expect(u).toBeCloseTo(0.3, 2)
    expect(v).toBeCloseTo(0.14, 2)
  })

  it("places the Ascent B site plant zone inside the site area", () => {
    const { u, v } = gameToMapFraction(ASCENT, -7770, -3097)

    expect(u).toBeCloseTo(0.27, 2)
    expect(v).toBeCloseTo(0.79, 2)
  })

  it("clamps out-of-range coordinates to the map edge", () => {
    const high = gameToMapFraction(ASCENT, 99999, -99999)
    const low = gameToMapFraction(ASCENT, -99999, 99999)

    expect(high).toEqual({ u: 1, v: 1 })
    expect(low).toEqual({ u: 0, v: 0 })
  })
})

describe("asset name lookup", () => {
  const maps = { ascent: ASCENT }
  const agents = {
    sova: { name: "Sova", displayIcon: "icon.png", portrait: "portrait.png" },
  }

  it("matches map names case-insensitively with trimming", () => {
    expect(mapAssetFor(maps, "Ascent")).toBe(ASCENT)
    expect(mapAssetFor(maps, " ascent ")).toBe(ASCENT)
    expect(mapAssetFor(maps, "Bind")).toBeUndefined()
  })

  it("matches agent names case-insensitively", () => {
    expect(agentAssetFor(agents, "SOVA")?.name).toBe("Sova")
    expect(agentAssetFor(agents, "Jett")).toBeUndefined()
  })
})
