import { buildMockProfile } from "@/lib/valorant/sample"
import type {
  PlayerLookup,
  PlayerProfile,
  ProviderResult,
  ValorantDataProvider,
} from "@/lib/valorant/types"

export class MockProvider implements ValorantDataProvider {
  async getPlayerProfile(lookup: PlayerLookup): Promise<ProviderResult<PlayerProfile>> {
    return { kind: "ready", value: buildMockProfile(lookup) }
  }
}
