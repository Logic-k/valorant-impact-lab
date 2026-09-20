import { Dashboard } from "@/components/dashboard"
import { readConfig } from "@/lib/config"
import { withRoundDecisions } from "@/lib/valorant/decisions/apply"
import { createValorantDataProvider } from "@/lib/valorant/providers/data-provider"
import type { PlayerLookup, ValorantRegion } from "@/lib/valorant/types"

type PageProps = {
  readonly searchParams?: Promise<Record<string, string | readonly string[] | undefined>>
}

export const maxDuration = 300

const DEFAULT_LOOKUP: PlayerLookup = {
  name: "Henrik3",
  tag: "VALO",
  region: "eu",
}

export default async function Home(props: PageProps) {
  const searchParams = props.searchParams === undefined ? {} : await props.searchParams
  const lookup = lookupFromSearchParams(searchParams)
  const config = readConfig()
  const provider = createValorantDataProvider(config)
  const result = await provider.getPlayerProfile(lookup)
  const profile = result.kind === "ready" ? result.value : result.fallback
  const providerWarning = result.kind === "unavailable" ? result.reason : null
  const analyzed = await withRoundDecisions(profile, config)

  return <Dashboard lookup={lookup} profile={analyzed} providerWarning={providerWarning} />
}

function lookupFromSearchParams(
  searchParams: Record<string, string | readonly string[] | undefined>,
): PlayerLookup {
  const name = firstValue(searchParams["name"]) ?? DEFAULT_LOOKUP.name
  const tag = firstValue(searchParams["tag"]) ?? DEFAULT_LOOKUP.tag
  const region = parseRegion(firstValue(searchParams["region"]))
  return { name, tag, region }
}

function firstValue(value: string | readonly string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value.length > 0 ? value : undefined
  }
  return value?.[0]
}

function parseRegion(value: string | undefined): ValorantRegion {
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
