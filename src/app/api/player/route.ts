import { readConfig } from "@/lib/config"
import { withRoundDecisions } from "@/lib/valorant/decisions/apply"
import { createValorantDataProvider } from "@/lib/valorant/providers/data-provider"
import type { PlayerLookup, ValorantRegion } from "@/lib/valorant/types"

const DEFAULT_LOOKUP: PlayerLookup = {
  name: "Henrik3",
  tag: "VALO",
  region: "eu",
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const lookup = {
    name: url.searchParams.get("name") ?? DEFAULT_LOOKUP.name,
    tag: url.searchParams.get("tag") ?? DEFAULT_LOOKUP.tag,
    region: parseRegion(url.searchParams.get("region")),
  } satisfies PlayerLookup
  const config = readConfig()
  const provider = createValorantDataProvider(config)
  const result = await provider.getPlayerProfile(lookup)

  if (result.kind !== "ready") {
    return Response.json(result, { status: 206 })
  }
  const analyzed = await withRoundDecisions(result.value, config)
  return Response.json({ kind: "ready", value: analyzed }, { status: 200 })
}

function parseRegion(value: string | null): ValorantRegion {
  switch (value) {
    case "na":
    case "eu":
    case "kr":
    case "ap":
    case "br":
    case "latam":
      return value
    default:
      return DEFAULT_LOOKUP.region
  }
}
