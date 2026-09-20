import type {
  DecisionAnswer,
  DecisionEngine,
  DecisionInput,
  DecisionQuestion,
} from "@/lib/valorant/decisions/engine"
import {
  PROFILE_AGENT_KEY,
  PROFILE_AGENT_SLOTS,
  PROFILE_FORM_KEY,
  PROFILE_STRONG_AXIS_KEY,
  PROFILE_WEAK_AXIS_KEY,
  TIER_LABELS,
} from "@/lib/valorant/decisions/schemas"
import { SIGNAL_LIMITS } from "@/lib/valorant/performance"
import { evaluateRoundReview } from "@/lib/valorant/round-review"
import type { PlayerProfile, RoundReport } from "@/lib/valorant/types"

const HIGH_IMPACT_SCORE = 360
const MEDIUM_IMPACT_SCORE = 180
const HIGH_COST_SPEND = 3000
const MIN_AGENT_MATCHES = 3

export class RulesEngine implements DecisionEngine {
  readonly name = "rules" as const

  decide(
    input: DecisionInput,
    questions: readonly DecisionQuestion[],
  ): Promise<readonly DecisionAnswer[]> {
    const round = input.round
    if (round !== undefined) {
      const review = evaluateRoundReview(round)
      return Promise.resolve(questions.map((question) => answerFor(question, round, review)))
    }
    const profile = input.profile
    if (profile === undefined) {
      return Promise.resolve(questions.map((question) => ({ key: question.key, confidence: 0 })))
    }
    return Promise.resolve(questions.map((question) => profileAnswerFor(question, profile)))
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

function profileAnswerFor(question: DecisionQuestion, profile: PlayerProfile): DecisionAnswer {
  if (question.kind !== "choice") {
    return { key: question.key, confidence: 0 }
  }
  switch (question.key) {
    case PROFILE_STRONG_AXIS_KEY:
      return axisAnswer(question.key, profile.summary, "strong")
    case PROFILE_WEAK_AXIS_KEY:
      return axisAnswer(question.key, profile.summary, "weak")
    case PROFILE_FORM_KEY:
      return formAnswer(question.key, profile)
    case PROFILE_AGENT_KEY:
      return agentAnswer(question.key, profile)
    default:
      return { key: question.key, confidence: 0 }
  }
}

function axisValues(summary: PlayerProfile["summary"]) {
  const perMatchAssists = summary.matches > 0 ? summary.assists / summary.matches : 0
  return [
    { axis: "교전 생산성", value: summary.averageAcs, limits: SIGNAL_LIMITS.acs },
    { axis: "데미지 압박", value: summary.adr, limits: SIGNAL_LIMITS.adr },
    { axis: "교전 효율", value: summary.kdRatio, limits: SIGNAL_LIMITS.kd },
    { axis: "팀 연계", value: perMatchAssists, limits: SIGNAL_LIMITS.assists },
  ]
}

function axisAnswer(
  key: string,
  summary: PlayerProfile["summary"],
  direction: "strong" | "weak",
): DecisionAnswer {
  const scored = axisValues(summary)
    .map((entry) => ({
      axis: entry.axis,
      ratio: entry.value / (direction === "strong" ? entry.limits.strongAt : entry.limits.weakAt),
    }))
    .sort((left, right) =>
      direction === "strong" ? right.ratio - left.ratio : left.ratio - right.ratio,
    )
  const best = scored[0]
  const runnerUp = scored[1]
  if (best === undefined || runnerUp === undefined) {
    return { key, confidence: 0 }
  }
  const margin = Math.abs(best.ratio - runnerUp.ratio)
  return {
    key,
    choice: best.axis,
    confidence: Math.round(Math.min(0.5 + margin, 0.9) * 100) / 100,
  }
}

function formAnswer(key: string, profile: PlayerProfile): DecisionAnswer {
  const recent = profile.recentMatches.slice(0, 8)
  if (recent.length < 4) {
    return { key, choice: "유지", confidence: 0.4 }
  }
  const recentWinRate =
    (recent.filter((match) => match.result === "win").length / recent.length) * 100
  const recentAcs = recent.reduce((sum, match) => sum + match.acs, 0) / recent.length
  const signal =
    (recentWinRate - profile.summary.winRate) / 8 + (recentAcs - profile.summary.averageAcs) / 20
  const choice = signal >= 1 ? "상승세" : signal <= -1 ? "하락세" : "유지"
  return {
    key,
    choice,
    confidence: Math.round(Math.min(0.5 + Math.abs(signal) * 0.15, 0.9) * 100) / 100,
  }
}

function agentAnswer(key: string, profile: PlayerProfile): DecisionAnswer {
  const seasoned = profile.insights.agentBreakdown.filter(
    (agent) => agent.matches >= MIN_AGENT_MATCHES,
  )
  const pool = seasoned.length > 0 ? seasoned : profile.insights.agentBreakdown
  const ranked = [...pool.slice(0, PROFILE_AGENT_SLOTS)].sort(
    (left, right) => right.impactScore - left.impactScore,
  )
  const best = ranked[0]
  if (best === undefined) {
    return { key, confidence: 0 }
  }
  const margin = best.impactScore - (ranked[1]?.impactScore ?? 0)
  return {
    key,
    choice: best.name,
    confidence: Math.round(Math.min(0.55 + margin / 50, 0.95) * 100) / 100,
  }
}
