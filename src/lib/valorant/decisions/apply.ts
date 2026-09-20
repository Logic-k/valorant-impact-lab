import type { AppConfig } from "@/lib/config"
import type {
  DecisionAnswer,
  DecisionEngine,
  DecisionEngineName,
} from "@/lib/valorant/decisions/engine"
import { createDecisionEngine } from "@/lib/valorant/decisions/factory"
import {
  ROUND_REASON_KEY,
  ROUND_REVIEW_KEY,
  ROUND_TIER_KEY,
  roundQuestions,
  roundState,
  tierLabelForScore,
} from "@/lib/valorant/decisions/schemas"
import type {
  DecisionSummary,
  PlayerProfile,
  RoundDecision,
  RoundDetailInsights,
  RoundReport,
} from "@/lib/valorant/types"

const UNCERTAIN_BELOW = 0.55
const REVIEW_PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 } as const

export type ApplyOptions = {
  readonly maxRounds: number
  readonly concurrency: number
}

export async function withRoundDecisions(
  profile: PlayerProfile,
  config: AppConfig,
): Promise<PlayerProfile> {
  try {
    const engine = createDecisionEngine(config)
    const roundDetails = await applyRoundDecisions(profile.roundDetails, engine, {
      maxRounds: config.DECISION_MAX_ROUNDS,
      concurrency: config.DECISION_CONCURRENCY,
    })
    return { ...profile, roundDetails }
  } catch {
    return profile
  }
}

export async function applyRoundDecisions(
  details: RoundDetailInsights,
  engine: DecisionEngine,
  options: ApplyOptions,
): Promise<RoundDetailInsights> {
  const candidates = pickRounds(details.rounds, options.maxRounds)
  if (candidates.length === 0) {
    return details
  }
  const questions = roundQuestions()
  const decisions = new Map<string, RoundDecision>()
  for (let index = 0; index < candidates.length; index += options.concurrency) {
    const batch = candidates.slice(index, index + options.concurrency)
    await Promise.all(
      batch.map(async (round) => {
        const answers = await engine.decide({ state: roundState(round), round }, questions)
        decisions.set(roundKey(round), toRoundDecision(engine.name, round, answers))
      }),
    )
  }

  const annotate = (round: RoundReport): RoundReport => {
    const decision = decisions.get(roundKey(round))
    return decision === undefined ? round : { ...round, decision }
  }

  return {
    ...details,
    rounds: details.rounds.map(annotate),
    reviewRounds: details.reviewRounds.map(annotate),
    matchReports: details.matchReports.map((report) => ({
      ...report,
      rounds: report.rounds.map(annotate),
    })),
    decisionSummary: summarize(engine.name, [...decisions.values()]),
  }
}

function pickRounds(rounds: readonly RoundReport[], maxRounds: number): readonly RoundReport[] {
  if (rounds.length <= maxRounds) {
    return rounds
  }
  return [...rounds]
    .sort(
      (left, right) =>
        REVIEW_PRIORITY_WEIGHT[right.reviewPriority] - REVIEW_PRIORITY_WEIGHT[left.reviewPriority],
    )
    .slice(0, maxRounds)
}

function toRoundDecision(
  engine: DecisionEngineName,
  round: RoundReport,
  answers: readonly DecisionAnswer[],
): RoundDecision {
  const reason = answers.find((answer) => answer.key === ROUND_REASON_KEY)
  const tier = answers.find((answer) => answer.key === ROUND_TIER_KEY)
  const review = answers.find((answer) => answer.key === ROUND_REVIEW_KEY)
  const comparison =
    reason?.shadowChoice === undefined
      ? undefined
      : {
          reason: reason.shadowChoice,
          confidence: reason.shadowConfidence ?? 0,
          agree: reason.shadowChoice === reason.choice,
        }
  return {
    engine,
    reason: reason?.choice ?? round.reviewReason,
    reasonConfidence: reason?.confidence ?? 0,
    ...(tier?.score === undefined ? {} : { tierLabel: tierLabelForScore(tier.score) }),
    reviewScore: review?.noul ?? 0,
    ...(comparison === undefined ? {} : { comparison }),
  }
}

function summarize(
  engine: DecisionEngineName,
  decisions: readonly RoundDecision[],
): DecisionSummary {
  const total = decisions.length
  const compared = decisions.filter((decision) => decision.comparison !== undefined)
  const agreed = compared.filter((decision) => decision.comparison?.agree === true)
  return {
    engine,
    scoredRounds: total,
    averageConfidence:
      total === 0
        ? 0
        : Math.round(
            (decisions.reduce((sum, decision) => sum + decision.reasonConfidence, 0) / total) * 100,
          ) / 100,
    uncertainRounds: decisions.filter((decision) => decision.reasonConfidence < UNCERTAIN_BELOW)
      .length,
    ...(compared.length === 0
      ? {}
      : { agreementRate: Math.round((agreed.length / compared.length) * 100) }),
  }
}

function roundKey(round: RoundReport): string {
  return `${round.matchId}:${round.round}`
}
