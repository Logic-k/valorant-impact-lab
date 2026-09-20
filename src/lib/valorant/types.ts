export const DATA_SOURCES = ["mock", "henrik", "riot"] as const
export type DataSource = (typeof DATA_SOURCES)[number]

export const REGIONS = ["na", "eu", "kr", "ap", "br", "latam"] as const
export type ValorantRegion = (typeof REGIONS)[number]

export type PlayerLookup = {
  readonly name: string
  readonly tag: string
  readonly region: ValorantRegion
}

export type PentagonScore = {
  readonly combat: number
  readonly survival: number
  readonly utility: number
  readonly control: number
  readonly entry: number
}

export type MatchDigest = {
  readonly id: string
  readonly mapName: string
  readonly agent: string
  readonly mode: string
  readonly result: "win" | "loss"
  readonly score: string
  readonly acs: number
  readonly kills: number
  readonly deaths: number
  readonly assists: number
  readonly kdRatio: number
  readonly kast: number
  readonly adr: number
  readonly headshotRate: number
  readonly tradeValue: number
  readonly entryImpact: number
  readonly postPlantImpact: number
  readonly teamLuck: number
  readonly narrative: string
  readonly rrChange?: number
  readonly startedAt: string
  readonly accountLevel?: number
  readonly rankAtMatch?: string
}

export type DataCoverage = {
  readonly storedMatches: number
  readonly competitiveMatches: number
  readonly rangeLabel: string
  readonly seasonMode: "stored_range" | "official_act"
  readonly limitation: string
}

export type PerformanceBreakdown = {
  readonly name: string
  readonly dateRange?: string
  readonly matches: number
  readonly winRate: number
  readonly averageAcs: number
  readonly kdRatio: number
  readonly adr: number
  readonly headshotRate: number
  readonly impactScore: number
}

export type PerformanceInsights = {
  readonly coverage: DataCoverage
  readonly impactScore: number
  readonly impactLabel: string
  readonly strengths: readonly string[]
  readonly risks: readonly string[]
  readonly agentBreakdown: readonly PerformanceBreakdown[]
  readonly mapBreakdown: readonly PerformanceBreakdown[]
  readonly periodBreakdown: readonly PerformanceBreakdown[]
}

export type RoundMapEvent = {
  readonly matchId: string
  readonly mapName: string
  readonly round: number
  readonly kind: "kill" | "death" | "assist" | "plant" | "defuse"
  readonly x: number
  readonly y: number
  readonly label: string
}

export type RoundDecisionComparison = {
  readonly reason: string
  readonly confidence: number
  readonly agree: boolean
}

export type RoundDecision = {
  readonly engine: "rules" | "jev" | "jev-shadow"
  readonly reason: string
  readonly reasonConfidence: number
  readonly tierLabel?: string
  readonly reviewScore: number
  readonly comparison?: RoundDecisionComparison
}

export type DecisionSummary = {
  readonly engine: string
  readonly scoredRounds: number
  readonly averageConfidence: number
  readonly uncertainRounds: number
  readonly agreementRate?: number
}

export type RoundReport = {
  readonly matchId: string
  readonly mapName: string
  readonly startedAt: string
  readonly round: number
  readonly result: "win" | "loss"
  readonly kast: boolean
  readonly survived: boolean
  readonly traded: boolean
  readonly firstBlood: boolean
  readonly firstDeath: boolean
  readonly untradedDeath: boolean
  readonly clutchAttempt: boolean
  readonly clutchWin: boolean
  readonly kills: number
  readonly assists: number
  readonly damage: number
  readonly score: number
  readonly loadoutValue: number
  readonly spent: number
  readonly remaining: number
  readonly weaponName: string
  readonly armorName: string
  readonly contributionScore: number
  readonly contributionLabel: string
  readonly reviewPriority: "high" | "medium" | "low"
  readonly reviewReason: string
  readonly evidence: readonly string[]
  readonly timeline: readonly RoundTimelineEvent[]
  readonly decision?: RoundDecision
}

export type RoundTimelineEvent = {
  readonly timeMs: number
  readonly timeLabel: string
  readonly kind: "opening" | "kill" | "death" | "assist" | "trade" | "note"
  readonly text: string
  readonly emphasis: boolean
}

export type RoundDetailInsights = {
  readonly matchesAnalyzed: number
  readonly roundsAnalyzed: number
  readonly kastRate: number
  readonly survivalRate: number
  readonly tradeRate: number
  readonly clutchAttempts: number
  readonly clutchWins: number
  readonly firstBloods: number
  readonly firstDeaths: number
  readonly untradedDeaths: number
  readonly highImpactLosses: number
  readonly lowImpactWins: number
  readonly reviewRoundCount: number
  readonly averageLoadoutValue: number
  readonly averageSpent: number
  readonly note: string
  readonly rounds: readonly RoundReport[]
  readonly matchReports: readonly RoundMatchReport[]
  readonly reviewRounds: readonly RoundReport[]
  readonly mapEvents: readonly RoundMapEvent[]
  readonly decisionSummary?: DecisionSummary
}

export type RoundMatchReport = {
  readonly matchId: string
  readonly mapName: string
  readonly startedAt: string
  readonly rounds: readonly RoundReport[]
  readonly wins: number
  readonly losses: number
  readonly kills: number
  readonly assists: number
  readonly damage: number
  readonly kastRate: number
  readonly survivalRate: number
  readonly tradeRate: number
  readonly averageContributionScore: number
  readonly impactLabel: "강한 기여" | "보통 기여" | "낮은 기여"
  readonly summary: readonly string[]
  readonly highPriorityRounds: number
  readonly firstBloods: number
  readonly firstDeaths: number
  readonly untradedDeaths: number
}

export type PlayerProfile = {
  readonly displayName: string
  readonly tag: string
  readonly region: ValorantRegion
  readonly accountLevel: number
  readonly rank: string
  readonly rr: number
  readonly rrDelta?: number
  readonly source: DataSource
  readonly sourceLabel: string
  readonly consentState: "demo" | "user_entered" | "rso_required"
  readonly summary: {
    readonly matches: number
    readonly winRate: number
    readonly averageAcs: number
    readonly kills: number
    readonly deaths: number
    readonly assists: number
    readonly kdRatio: number
    readonly kast: number
    readonly adr: number
    readonly headshotRate: number
    readonly teamLuck: number
    readonly recentTeamLuck: number
  }
  readonly pentagon: PentagonScore
  readonly insights: PerformanceInsights
  readonly roundDetails: RoundDetailInsights
  readonly recentMatches: readonly MatchDigest[]
}

export type ProviderResult<T> =
  | { readonly kind: "ready"; readonly value: T }
  | { readonly kind: "unavailable"; readonly reason: string; readonly fallback: T }

export interface ValorantDataProvider {
  getPlayerProfile(lookup: PlayerLookup): Promise<ProviderResult<PlayerProfile>>
}
