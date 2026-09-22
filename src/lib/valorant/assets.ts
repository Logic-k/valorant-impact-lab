import ky from "ky"
import { z } from "zod"

const ASSETS_BASE_URL = "https://valorant-api.com/v1"
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const MapSchema = z.object({
  displayName: z.string(),
  displayIcon: z.string().nullable().optional(),
  splash: z.string().nullable().optional(),
  listViewIcon: z.string().nullable().optional(),
  xMultiplier: z.number().default(0),
  yMultiplier: z.number().default(0),
  xScalarToAdd: z.number().default(0),
  yScalarToAdd: z.number().default(0),
})

const AgentSchema = z.object({
  displayName: z.string(),
  displayIcon: z.string().nullable().optional(),
  fullPortrait: z.string().nullable().optional(),
  killfeedPortrait: z.string().nullable().optional(),
})

const AssetsEnvelopeSchema = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) })

export type MapAsset = {
  readonly name: string
  readonly displayIcon?: string
  readonly splash?: string
  readonly listViewIcon?: string
  readonly xMultiplier: number
  readonly yMultiplier: number
  readonly xScalarToAdd: number
  readonly yScalarToAdd: number
}

export type AgentAsset = {
  readonly name: string
  readonly displayIcon?: string
  readonly portrait?: string
}

export type ValorantAssets = {
  readonly maps: Readonly<Record<string, MapAsset>>
  readonly agents: Readonly<Record<string, AgentAsset>>
}

export const EMPTY_ASSETS: ValorantAssets = { maps: {}, agents: {} }

let cached: { readonly expiresAt: number; readonly value: ValorantAssets } | undefined
let pending: Promise<ValorantAssets> | undefined

export async function getValorantAssets(): Promise<ValorantAssets> {
  if (cached !== undefined && cached.expiresAt > Date.now()) {
    return cached.value
  }
  if (pending !== undefined) {
    return pending
  }
  pending = fetchAssets()
    .then((value) => {
      cached = { expiresAt: Date.now() + CACHE_TTL_MS, value }
      return value
    })
    .finally(() => {
      pending = undefined
    })
  return pending
}

async function fetchAssets(): Promise<ValorantAssets> {
  try {
    const client = ky.create({ prefixUrl: ASSETS_BASE_URL, timeout: 8000 })
    const [mapsResponse, agentsResponse] = await Promise.all([
      client.get("maps").json(),
      client.get("agents", { searchParams: { isPlayableCharacter: "true" } }).json(),
    ])
    return {
      maps: indexByName(AssetsEnvelopeSchema(MapSchema).parse(mapsResponse).data, toMapAsset),
      agents: indexByName(
        AssetsEnvelopeSchema(AgentSchema).parse(agentsResponse).data,
        toAgentAsset,
      ),
    }
  } catch {
    return EMPTY_ASSETS
  }
}

function indexByName<TRaw extends { displayName: string }, TAsset extends { name: string }>(
  rows: readonly TRaw[],
  convert: (row: TRaw) => TAsset,
): Record<string, TAsset> {
  const out: Record<string, TAsset> = {}
  for (const row of rows) {
    out[normalizeName(row.displayName)] = convert(row)
  }
  return out
}

function toMapAsset(row: z.infer<typeof MapSchema>): MapAsset {
  return {
    name: row.displayName,
    ...(row.displayIcon == null ? {} : { displayIcon: row.displayIcon }),
    ...(row.splash == null ? {} : { splash: row.splash }),
    ...(row.listViewIcon == null ? {} : { listViewIcon: row.listViewIcon }),
    xMultiplier: row.xMultiplier,
    yMultiplier: row.yMultiplier,
    xScalarToAdd: row.xScalarToAdd,
    yScalarToAdd: row.yScalarToAdd,
  }
}

function toAgentAsset(row: z.infer<typeof AgentSchema>): AgentAsset {
  return {
    name: row.displayName,
    ...(row.displayIcon == null ? {} : { displayIcon: row.displayIcon }),
    ...(row.fullPortrait == null ? {} : { portrait: row.fullPortrait }),
  }
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export function gameToMapFraction(
  map: Pick<MapAsset, "xMultiplier" | "xScalarToAdd" | "yMultiplier" | "yScalarToAdd">,
  x: number,
  y: number,
): { readonly u: number; readonly v: number } {
  return {
    u: clamp01(x * map.xMultiplier + map.xScalarToAdd),
    v: clamp01(y * map.yMultiplier + map.yScalarToAdd),
  }
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

export function mapAssetFor(maps: ValorantAssets["maps"], name: string): MapAsset | undefined {
  return maps[normalizeName(name)]
}

export function agentAssetFor(
  agents: ValorantAssets["agents"],
  name: string,
): AgentAsset | undefined {
  return agents[normalizeName(name)]
}
