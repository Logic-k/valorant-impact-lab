import type { AppConfig } from "@/lib/config"
import { HenrikDevProvider } from "@/lib/valorant/providers/henrik-provider"
import { MockProvider } from "@/lib/valorant/providers/mock-provider"
import { RiotProvider } from "@/lib/valorant/providers/riot-provider"
import type { ValorantDataProvider } from "@/lib/valorant/types"

export function createValorantDataProvider(config: AppConfig): ValorantDataProvider {
  switch (config.VALORANT_DATA_PROVIDER) {
    case "mock":
      return new MockProvider()
    case "henrik":
      if (config.HENRIKDEV_API_KEY === undefined || config.HENRIKDEV_API_KEY.length === 0) {
        return new MockProvider()
      }
      return new HenrikDevProvider({
        apiKey: config.HENRIKDEV_API_KEY,
        baseUrl: config.HENRIKDEV_BASE_URL,
      })
    case "riot":
      return new RiotProvider()
    default:
      return assertNever(config.VALORANT_DATA_PROVIDER)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected provider mode: ${JSON.stringify(value)}`)
}
