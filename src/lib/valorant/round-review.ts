import type { RoundReport } from "@/lib/valorant/types"

type RoundReviewInput = {
  readonly result: RoundReport["result"]
  readonly survived: boolean
  readonly traded: boolean
  readonly firstBlood: boolean
  readonly firstDeath: boolean
  readonly kills: number
  readonly assists: number
  readonly damage: number
  readonly score: number
  readonly spent: number
}

type RoundReview = {
  readonly contributionScore: number
  readonly contributionLabel: string
  readonly reviewPriority: RoundReport["reviewPriority"]
  readonly reviewReason: string
}

const HIGH_IMPACT_SCORE = 360
const MEDIUM_IMPACT_SCORE = 180

export function evaluateRoundReview(input: RoundReviewInput): RoundReview {
  const contributionScore = input.score + input.damage + input.kills * 35 + survivalBonus(input)
  const contributionLabel = labelForContribution(contributionScore)
  const reviewReason = reasonForRound(input, contributionScore)
  return {
    contributionScore,
    contributionLabel,
    reviewPriority: priorityForReason(reviewReason),
    reviewReason,
  }
}

export function sortReviewRounds(rounds: readonly RoundReport[]): readonly RoundReport[] {
  return [...rounds]
    .filter((round) => round.reviewPriority !== "low")
    .sort(
      (left, right) =>
        priorityWeight(right.reviewPriority) - priorityWeight(left.reviewPriority) ||
        right.contributionScore - left.contributionScore,
    )
    .slice(0, 8)
}

function survivalBonus(input: RoundReviewInput): number {
  if (input.survived) {
    return 25
  }
  return input.traded ? 10 : 0
}

function labelForContribution(score: number): string {
  if (score >= HIGH_IMPACT_SCORE) {
    return "고기여"
  }
  if (score >= MEDIUM_IMPACT_SCORE) {
    return "보통"
  }
  return "저기여"
}

function reasonForRound(input: RoundReviewInput, contributionScore: number): string {
  if (input.result === "loss" && contributionScore >= HIGH_IMPACT_SCORE) {
    return "고기여 패배"
  }
  if (input.firstDeath && !input.traded) {
    return "첫 데스 후 미교환"
  }
  if (!input.survived && !input.traded && input.spent >= 3000) {
    return "고비용 언트레이드 데스"
  }
  if (input.firstBlood) {
    return "첫 킬로 라운드 개입"
  }
  if (input.result === "win" && contributionScore < MEDIUM_IMPACT_SCORE) {
    return "저기여 승리"
  }
  if (input.traded) {
    return "사망 후 교환 성공"
  }
  return "안정 라운드"
}

function priorityForReason(reason: string): RoundReport["reviewPriority"] {
  switch (reason) {
    case "고기여 패배":
    case "첫 데스 후 미교환":
    case "고비용 언트레이드 데스":
      return "high"
    case "첫 킬로 라운드 개입":
    case "저기여 승리":
    case "사망 후 교환 성공":
      return "medium"
    case "안정 라운드":
      return "low"
    default:
      return "low"
  }
}

function priorityWeight(priority: RoundReport["reviewPriority"]): number {
  switch (priority) {
    case "high":
      return 3
    case "medium":
      return 2
    case "low":
      return 1
  }
}
