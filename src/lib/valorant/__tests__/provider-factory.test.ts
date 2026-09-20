import { describe, expect, it } from "vitest"

import type { AppConfig } from "@/lib/config"
import { createValorantDataProvider } from "@/lib/valorant/providers/data-provider"

const LOOKUP = {
  name: "Henrik3",
  tag: "VALO",
  region: "eu",
} as const

const BASE_CONFIG = {
  HENRIKDEV_API_KEY: "",
  HENRIKDEV_BASE_URL: "https://api.henrikdev.xyz",
  ANALYSIS_ENGINE: "rules",
  TYPESAFE_BASE_URL: "https://api.typesafe.ai",
  TYPESAFE_MODEL: "jev-latest",
  DECISION_MAX_ROUNDS: 40,
  DECISION_CONCURRENCY: 4,
} as const

describe("createValorantDataProvider", () => {
  it("falls back to mock provider when HenrikDev mode has no API key", async () => {
    const config = {
      ...BASE_CONFIG,
      VALORANT_DATA_PROVIDER: "henrik",
    } satisfies AppConfig

    const provider = createValorantDataProvider(config)
    const result = await provider.getPlayerProfile(LOOKUP)

    expect(result.kind).toBe("ready")
    if (result.kind === "ready") {
      expect(result.value.source).toBe("mock")
    }
  })

  it("keeps Riot mode unavailable until official approval is wired", async () => {
    const config = {
      ...BASE_CONFIG,
      VALORANT_DATA_PROVIDER: "riot",
    } satisfies AppConfig

    const provider = createValorantDataProvider(config)
    const result = await provider.getPlayerProfile(LOOKUP)

    expect(result.kind).toBe("unavailable")
    if (result.kind === "unavailable") {
      expect(result.fallback.source).toBe("mock")
    }
  })
})
