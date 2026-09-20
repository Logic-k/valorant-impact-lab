import type { PlayerProfile, RoundReport } from "@/lib/valorant/types"

export const DECISION_ENGINES = ["rules", "jev", "jev-shadow"] as const
export type DecisionEngineName = (typeof DECISION_ENGINES)[number]

export type DecisionQuestion =
  | {
      readonly kind: "choice"
      readonly key: string
      readonly instructions: string
      readonly criteria: Readonly<Record<string, string>>
    }
  | {
      readonly kind: "score"
      readonly key: string
      readonly instructions: string
      readonly levels: readonly string[]
    }
  | { readonly kind: "noul"; readonly key: string; readonly instructions: string }

export type DecisionInput = {
  readonly state: string
  readonly round?: RoundReport
  readonly profile?: PlayerProfile
}

export type DecisionAnswer = {
  readonly key: string
  readonly choice?: string
  readonly score?: number
  readonly noul?: number
  readonly confidence: number
  readonly shadowChoice?: string
  readonly shadowConfidence?: number
}

export interface DecisionEngine {
  readonly name: DecisionEngineName
  decide(
    input: DecisionInput,
    questions: readonly DecisionQuestion[],
  ): Promise<readonly DecisionAnswer[]>
}
