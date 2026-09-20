import type {
  DecisionAnswer,
  DecisionEngine,
  DecisionInput,
  DecisionQuestion,
} from "@/lib/valorant/decisions/engine"
import { TIER_LABELS } from "@/lib/valorant/decisions/schemas"
import { evaluateRoundReview } from "@/lib/valorant/round-review"
import type { RoundReport } from "@/lib/valorant/types"

const HIGH_IMPACT_SCORE = 360
const MEDIUM_IMPACT_SCORE = 180
const HIGH_COST_SPEND = 3000

export class RulesEngine implements DecisionEngine {
  readonly name = "rules" as const

  decide(
    input: DecisionInput,
    questions: readonly DecisionQuestion[],
  ): Promise<readonly DecisionAnswer[]> {
    const review = evaluateRoundReview(input.round)
    return Promise.resolve(questions.map((question) => answerFor(question, input.round, review)))
  }
}

function answerFor(
  question: DecisionQuestion,
  round: RoundReport,
  review: ReturnType<typeof evaluateRoundReview>,
): DecisionAnswer {
  switch (question.kind) {
    case "choice":
      return {
        key: question.key,
        choice: review.reviewReason,
        confidence: reasonConfidence(round, review),
      }
    case "score":
      return {
        key: question.key,
        score: tierIndex(review.contributionLabel),
        confidence: tierConfidence(review.contributionScore),
      }
    case "noul":
      return { key: question.key, noul: reviewNoul(review.reviewPriority), confidence: 0.8 }
  }
}

function reasonConfidence(
  round: RoundReport,
  review: ReturnType<typeof evaluateRoundReview>,
): number {
  switch (review.reviewReason) {
    case "고기여 패배":
      return marginConfidence(review.contributionScore - HIGH_IMPACT_SCORE)
    case "저기여 승리":
      return marginConfidence(MEDIUM_IMPACT_SCORE - review.contributionScore)
    case "고비용 언트레이드 데스":
      return marginConfidence((round.spent - HIGH_COST_SPEND) / 10)
    case "안정 라운드":
      return 0.5
    default:
      return 0.85
  }
}

function tierIndex(label: string): number {
  const index = TIER_LABELS.indexOf(label as (typeof TIER_LABELS)[number])
  return index === -1 ? 1 : index
}

function tierConfidence(contributionScore: number): number {
  const margin = Math.min(
    Math.abs(contributionScore - MEDIUM_IMPACT_SCORE),
    Math.abs(contributionScore - HIGH_IMPACT_SCORE),
  )
  return marginConfidence(margin)
}

function reviewNoul(priority: RoundReport["reviewPriority"]): number {
  switch (priority) {
    case "high":
      return 0.9
    case "medium":
      return 0.6
    case "low":
      return 0.15
  }
}

function marginConfidence(margin: number): number {
  const clamped = Math.min(Math.max(margin / 400, 0), 0.45)
  return Math.round((0.55 + clamped) * 100) / 100
}
