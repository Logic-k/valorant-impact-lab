import { RiotProviderUnavailableError } from "@/lib/errors"
import { buildMockProfile } from "@/lib/valorant/sample"
import type {
  PlayerLookup,
  PlayerProfile,
  ProviderResult,
  ValorantDataProvider,
} from "@/lib/valorant/types"

export class RiotProvider implements ValorantDataProvider {
  async getPlayerProfile(lookup: PlayerLookup): Promise<ProviderResult<PlayerProfile>> {
    return {
      kind: "unavailable",
      reason: new RiotProviderUnavailableError().message,
      fallback: buildMockProfile(lookup),
    }
  }
}
