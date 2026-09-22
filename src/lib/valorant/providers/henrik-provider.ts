import ky, { HTTPError } from "ky"
import { ZodError } from "zod"

import { HenrikDevUnavailableError } from "@/lib/errors"
import {
  type AccountData,
  AccountEnvelopeSchema,
  HenrikErrorEnvelopeSchema,
  type MatchDetailData,
  MatchDetailEnvelopeSchema,
  type MmrData,
  MmrEnvelopeSchema,
  type StoredMatchData,
  StoredMatchesEnvelopeSchema,
  type StoredMmrHistoryEntry,
  StoredMmrHistoryEnvelopeSchema,
} from "@/lib/valorant/providers/henrik-schemas"
import { providerRegion, toProfile } from "@/lib/valorant/providers/henrik-transform"
import { buildMockProfile } from "@/lib/valorant/sample"
import type {
  PlayerLookup,
  PlayerProfile,
  ProviderResult,
  ValorantDataProvider,
  ValorantRegion,
} from "@/lib/valorant/types"

type CachedResponse = {
  readonly expiresAt: number
  readonly value: unknown
}

type HenrikProviderConfig = {
  readonly apiKey: string
  readonly baseUrl: string
}

const DETAIL_MATCH_LIMIT = 8
const MATCH_DETAIL_CONCURRENCY = 2
const RESPONSE_CACHE_TTL_MS = 60_000
const responseCache = new Map<string, CachedResponse>()
const pendingRequests = new Map<string, Promise<unknown>>()

export class HenrikDevProvider implements ValorantDataProvider {
  private readonly client: typeof ky

  constructor(config: HenrikProviderConfig) {
    this.client = ky.create({
      prefixUrl: config.baseUrl.replace(/\/$/, ""),
      headers: { Authorization: config.apiKey },
      retry: {
        limit: 1,
        statusCodes: [408, 500, 502, 503, 504],
      },
      timeout: 6000,
    })
  }

  async getPlayerProfile(lookup: PlayerLookup): Promise<ProviderResult<PlayerProfile>> {
    try {
      const account = await this.fetchAccount(lookup)
      const region = providerRegion(account, lookup.region)
      const [mmr, matches, mmrHistory] = await Promise.all([
        this.fetchOptionalMmr(lookup, region),
        this.fetchStoredMatches(lookup, region),
        this.fetchOptionalMmrHistory(lookup, region),
      ])
      const details = await this.fetchMatchDetails(detailCandidateIds(matches))
      return {
        kind: "ready",
        value: toProfile(lookup, account, mmr, matches, details, mmrHistory),
      }
    } catch (error) {
      if (error instanceof HenrikDevUnavailableError) {
        return { kind: "unavailable", reason: error.message, fallback: buildMockProfile(lookup) }
      }
      if (error instanceof HTTPError) {
        const message = await henrikErrorMessage(error)
        return {
          kind: "unavailable",
          reason: message,
          fallback: buildMockProfile(lookup),
        }
      }
      if (error instanceof ZodError) {
        return {
          kind: "unavailable",
          reason: "HenrikDev response shape changed",
          fallback: buildMockProfile(lookup),
        }
      }
      if (error instanceof Error) {
        return { kind: "unavailable", reason: error.message, fallback: buildMockProfile(lookup) }
      }
      throw error
    }
  }

  private async fetchAccount(lookup: PlayerLookup): Promise<AccountData> {
    const response = await this.getJson(
      `valorant/v2/account/${encodeURIComponent(lookup.name)}/${encodeURIComponent(lookup.tag)}`,
    )
    const parsed = AccountEnvelopeSchema.parse(response)
    if (parsed.data === null) {
      throw new HenrikDevUnavailableError("HenrikDev account lookup returned no data")
    }
    return parsed.data
  }

  private async fetchOptionalMmr(
    lookup: PlayerLookup,
    region: ValorantRegion,
  ): Promise<MmrData | null> {
    try {
      const response = await this.getJson(
        `valorant/v2/mmr/${region}/${encodeURIComponent(lookup.name)}/${encodeURIComponent(
          lookup.tag,
        )}`,
      )
      const parsed = MmrEnvelopeSchema.parse(response)
      return parsed.data
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        return null
      }
      throw error
    }
  }

  private async fetchOptionalMmrHistory(
    lookup: PlayerLookup,
    region: ValorantRegion,
  ): Promise<readonly StoredMmrHistoryEntry[]> {
    try {
      const response = await this.getJson(
        `valorant/v2/stored-mmr-history/${region}/pc/${encodeURIComponent(
          lookup.name,
        )}/${encodeURIComponent(lookup.tag)}?size=40`,
      )
      const parsed = StoredMmrHistoryEnvelopeSchema.parse(response)
      return parsed.data ?? []
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        return []
      }
      if (error instanceof ZodError) {
        return []
      }
      throw error
    }
  }

  private async fetchStoredMatches(
    lookup: PlayerLookup,
    region: ValorantRegion,
  ): Promise<readonly StoredMatchData[]> {
    const response = await this.getJson(
      `valorant/v1/stored-matches/${region}/${encodeURIComponent(
        lookup.name,
      )}/${encodeURIComponent(lookup.tag)}`,
    )
    const parsed = StoredMatchesEnvelopeSchema.parse(response)
    return parsed.data ?? []
  }

  private async fetchMatchDetails(
    matchIds: readonly string[],
  ): Promise<readonly MatchDetailData[]> {
    const details: (MatchDetailData | undefined)[] = []
    for (let index = 0; index < matchIds.length; index += MATCH_DETAIL_CONCURRENCY) {
      const batch = matchIds.slice(index, index + MATCH_DETAIL_CONCURRENCY)
      details.push(
        ...(await Promise.all(batch.map((matchId) => this.fetchOptionalMatchDetail(matchId)))),
      )
    }
    return details.filter((detail) => detail !== undefined)
  }

  private async fetchOptionalMatchDetail(matchId: string): Promise<MatchDetailData | undefined> {
    try {
      const response = await this.getJson(`valorant/v2/match/${matchId}`)
      const parsed = MatchDetailEnvelopeSchema.parse(response)
      return parsed.data ?? undefined
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        return undefined
      }
      if (error instanceof ZodError) {
        return undefined
      }
      throw error
    }
  }

  private async getJson(path: string): Promise<unknown> {
    const cached = responseCache.get(path)
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.value
    }
    const pending = pendingRequests.get(path)
    if (pending !== undefined) {
      return pending
    }
    const request = this.client
      .get(path)
      .json()
      .then((value) => {
        responseCache.set(path, {
          expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
          value,
        })
        return value
      })
      .finally(() => {
        pendingRequests.delete(path)
      })
    pendingRequests.set(path, request)
    return request
  }
}

function detailCandidateIds(matches: readonly StoredMatchData[]): readonly string[] {
  return matches
    .filter(
      (match) =>
        match.meta.mode === "Competitive" &&
        (match.stats.team === "Blue" || match.stats.team === "Red"),
    )
    .slice(0, DETAIL_MATCH_LIMIT)
    .map((match) => match.meta.id)
}

async function henrikErrorMessage(error: HTTPError): Promise<string> {
  try {
    const body = await error.response.json()
    const parsed = HenrikErrorEnvelopeSchema.safeParse(body)
    if (parsed.success) {
      const firstError = parsed.data.errors[0]
      if (firstError !== undefined) {
        return `HenrikDev ${error.response.status}: ${firstError.message}`
      }
    }
  } catch (cause) {
    if (cause instanceof Error) {
      return `HenrikDev returned HTTP ${error.response.status}`
    }
    throw cause
  }
  return `HenrikDev returned HTTP ${error.response.status}`
}
