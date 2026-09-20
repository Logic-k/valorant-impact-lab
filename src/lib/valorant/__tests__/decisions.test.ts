import { describe, expect, it } from "vitest"
import type { AppConfig } from "@/lib/config"
import { applyRoundDecisions } from "@/lib/valorant/decisions/apply"
import { ComparingEngine } from "@/lib/valorant/decisions/comparing-engine"
import { createDecisionEngine } from "@/lib/valorant/decisions/factory"
import { JevEngine } from "@/lib/valorant/decisions/jev-engine"
import { RulesEngine } from "@/lib/valorant/decisions/rules-engine"
import { roundQuestions, roundState } from "@/lib/valorant/decisions/schemas"
import type { RoundDetailInsights, RoundReport } from "@/lib/valorant/types"

function makeRound(overrides: Partial<RoundReport> = {}): RoundReport {
  return {
    matchId: "match-1",
    mapName: "Ascent",
    startedAt: "2026-07-04T14:52:51.000Z",
    round: 1,
    result: "loss",
    kast: false,
    survived: false,
    traded: false,
    firstBlood: false,
    firstDeath: true,
    untradedDeath: true,
    clutchAttempt: false,
    clutchWin: false,
    kills: 0,
    assists: 0,
    damage: 40,
    score: 40,
    loadoutValue: 800,
    spent: 800,
    remaining: 0,
    weaponName: "Classic",
    armorName: "None",
    contributionScore: 80,
    contributionLabel: "저기여",
    reviewPriority: "high",
    reviewReason: "첫 데스 후 미교환",
    evidence: ["0킬 40딜 후 패배", "라운드 첫 사망", "사망 후 5초 내 교환 없음"],
    timeline: [],
    ...overrides,
  }
}

function makeDetails(rounds: readonly RoundReport[]): RoundDetailInsights {
  return {
    matchesAnalyzed: 1,
    roundsAnalyzed: rounds.length,
    kastRate: 0,
    survivalRate: 0,
    tradeRate: 0,
    clutchAttempts: 0,
    clutchWins: 0,
    firstBloods: 0,
    firstDeaths: 1,
    untradedDeaths: 1,
    highImpactLosses: 0,
    lowImpactWins: 0,
    reviewRoundCount: rounds.length,
    averageLoadoutValue: 800,
    averageSpent: 800,
    note: "test",
    rounds,
    matchReports: [
      {
        matchId: "match-1",
        mapName: "Ascent",
        startedAt: "2026-07-04T14:52:51.000Z",
        rounds,
        wins: 0,
        losses: 1,
        kills: 0,
        assists: 0,
        damage: 40,
        kastRate: 0,
        survivalRate: 0,
        tradeRate: 0,
        averageContributionScore: 80,
        impactLabel: "낮은 기여",
        summary: [],
        highPriorityRounds: 1,
        firstBloods: 0,
        firstDeaths: 1,
        untradedDeaths: 1,
      },
    ],
    reviewRounds: rounds,
    mapEvents: [],
  }
}

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    VALORANT_DATA_PROVIDER: "mock",
    HENRIKDEV_BASE_URL: "https://api.henrikdev.xyz",
    ANALYSIS_ENGINE: "rules",
    TYPESAFE_BASE_URL: "https://api.typesafe.ai",
    TYPESAFE_MODEL: "jev-latest",
    DECISION_MAX_ROUNDS: 40,
    DECISION_CONCURRENCY: 4,
    ...overrides,
  }
}

const QUESTIONS = roundQuestions()

describe("rules decision engine", () => {
  it("answers every question from the rule-based review", async () => {
    const engine = new RulesEngine()
    const round = makeRound()
    const answers = await engine.decide({ state: roundState(round), round }, QUESTIONS)

    const reason = answers.find((answer) => answer.key === "round_reason")
    expect(reason?.choice).toBe("첫 데스 후 미교환")
    expect(reason?.confidence).toBeGreaterThan(0)
    expect(reason?.confidence).toBeLessThanOrEqual(1)

    const tier = answers.find((answer) => answer.key === "contribution_tier")
    expect(tier?.score).toBe(0)

    const review = answers.find((answer) => answer.key === "needs_review")
    expect(review?.noul).toBe(0.9)
  })
})

describe("roundState", () => {
  it("serializes the round into a compact text state", () => {
    const state = roundState(makeRound())
    expect(state).toContain("맵 Ascent")
    expect(state).toContain("첫 데스")
    expect(state).toContain("Classic")
    expect(state).not.toContain("판단 사유")
  })
})

describe("jev decision engine", () => {
  it("posts the System One payload shape and maps typed answers", async () => {
    const seen: Record<string, unknown>[] = []
    const engine = new JevEngine({
      apiKey: "test-key",
      baseUrl: "https://api.typesafe.ai",
      model: "jev-latest",
      transport: (payload) => {
        seen.push(payload)
        return Promise.resolve({
          model: "jev-1.13.0",
          answers: {
            round_reason: {
              type: "choice",
              choice: "고기여 패배",
              confidence: 0.72,
              probabilities: { "고기여 패배": 0.72, "안정 라운드": 0.2 },
            },
            contribution_tier: {
              type: "score",
              score: 2,
              confidence: 0.9,
              probabilities: { "0": 0.05, "1": 0.15, "2": 0.8 },
            },
            needs_review: { type: "noul", noul: 0.93 },
          },
          usage: { input_tokens: 210, output_tokens: 30 },
        })
      },
    })

    const round = makeRound()
    const answers = await engine.decide({ state: roundState(round), round }, QUESTIONS)

    expect(seen).toHaveLength(1)
    const payload = seen[0] as {
      state: string
      model: string
      questions: Record<string, { type: string }>
    }
    expect(payload.model).toBe("jev-latest")
    expect(payload.state).toContain("맵 Ascent")
    expect(payload.questions["round_reason"]?.type).toBe("choice")
    expect(payload.questions["contribution_tier"]?.type).toBe("score")
    expect(payload.questions["needs_review"]?.type).toBe("noul")

    const reason = answers.find((answer) => answer.key === "round_reason")
    expect(reason?.choice).toBe("고기여 패배")
    expect(reason?.confidence).toBe(0.72)
    const review = answers.find((answer) => answer.key === "needs_review")
    expect(review?.noul).toBe(0.93)
  })
})

describe("comparing engine", () => {
  const jevAnswers = {
    model: "jev-1.13.0",
    answers: {
      round_reason: { type: "choice", choice: "안정 라운드", confidence: 0.61 },
      contribution_tier: { type: "score", score: 1, confidence: 0.7 },
      needs_review: { type: "noul", noul: 0.4 },
    },
  }

  it("jev-primary mode returns jev answers and keeps rules as the comparison", async () => {
    const jev = new JevEngine({
      apiKey: "test",
      baseUrl: "https://api.typesafe.ai",
      model: "jev-latest",
      transport: () => Promise.resolve(jevAnswers),
    })
    const engine = new ComparingEngine(jev, new RulesEngine(), "jev")
    expect(engine.name).toBe("jev")

    const round = makeRound()
    const answers = await engine.decide({ state: roundState(round), round }, QUESTIONS)
    const reason = answers.find((answer) => answer.key === "round_reason")
    expect(reason?.choice).toBe("안정 라운드")
    expect(reason?.shadowChoice).toBe("첫 데스 후 미교환")
  })

  it("shadow mode keeps rules as primary and jev as the comparison", async () => {
    const jev = new JevEngine({
      apiKey: "test",
      baseUrl: "https://api.typesafe.ai",
      model: "jev-latest",
      transport: () => Promise.resolve(jevAnswers),
    })
    const engine = new ComparingEngine(jev, new RulesEngine(), "rules")
    expect(engine.name).toBe("jev-shadow")

    const round = makeRound()
    const answers = await engine.decide({ state: roundState(round), round }, QUESTIONS)
    const reason = answers.find((answer) => answer.key === "round_reason")
    expect(reason?.choice).toBe("첫 데스 후 미교환")
    expect(reason?.shadowChoice).toBe("안정 라운드")
    expect(reason?.shadowConfidence).toBe(0.61)
  })

  it("falls back to rules answers when the jev call fails", async () => {
    const jev = new JevEngine({
      apiKey: "test",
      baseUrl: "https://api.typesafe.ai",
      model: "jev-latest",
      transport: () => Promise.reject(new Error("network down")),
    })
    const engine = new ComparingEngine(jev, new RulesEngine(), "jev")

    const round = makeRound()
    const answers = await engine.decide({ state: roundState(round), round }, QUESTIONS)
    const reason = answers.find((answer) => answer.key === "round_reason")
    expect(reason?.choice).toBe("첫 데스 후 미교환")
  })
})

describe("applyRoundDecisions", () => {
  it("annotates rounds, review rounds, and match report rounds with a summary", async () => {
    const rounds = [
      makeRound({ round: 1 }),
      makeRound({
        round: 2,
        result: "win",
        kast: true,
        survived: true,
        firstDeath: false,
        untradedDeath: false,
        kills: 1,
        damage: 120,
        score: 250,
        contributionScore: 430,
        contributionLabel: "고기여",
        reviewPriority: "low",
        reviewReason: "안정 라운드",
      }),
    ]
    const details = makeDetails(rounds)
    const enriched = await applyRoundDecisions(details, new RulesEngine(), {
      maxRounds: 40,
      concurrency: 4,
    })

    expect(enriched.decisionSummary?.engine).toBe("rules")
    expect(enriched.decisionSummary?.scoredRounds).toBe(2)
    expect(enriched.rounds[0]?.decision?.reason).toBe("첫 데스 후 미교환")
    expect(enriched.reviewRounds[0]?.decision).toBeDefined()
    expect(enriched.matchReports[0]?.rounds[1]?.decision?.reason).toBe("안정 라운드")
  })

  it("caps scoring at maxRounds preferring high-priority rounds", async () => {
    const rounds = [
      makeRound({ round: 1, reviewPriority: "low", reviewReason: "안정 라운드" }),
      makeRound({ round: 2 }),
      makeRound({ round: 3, reviewPriority: "low", reviewReason: "안정 라운드" }),
    ]
    const details = makeDetails(rounds)
    const enriched = await applyRoundDecisions(details, new RulesEngine(), {
      maxRounds: 1,
      concurrency: 1,
    })

    expect(enriched.decisionSummary?.scoredRounds).toBe(1)
    expect(enriched.rounds[1]?.decision?.reason).toBe("첫 데스 후 미교환")
    expect(enriched.rounds[0]?.decision).toBeUndefined()
  })

  it("records agreement rate when a shadow comparison exists", async () => {
    const jev = new JevEngine({
      apiKey: "test",
      baseUrl: "https://api.typesafe.ai",
      model: "jev-latest",
      transport: () =>
        Promise.resolve({
          answers: {
            round_reason: { type: "choice", choice: "첫 데스 후 미교환", confidence: 0.9 },
            needs_review: { type: "noul", noul: 0.8 },
          },
        }),
    })
    const engine = new ComparingEngine(jev, new RulesEngine(), "rules")
    const details = makeDetails([makeRound()])
    const enriched = await applyRoundDecisions(details, engine, {
      maxRounds: 10,
      concurrency: 2,
    })

    expect(enriched.decisionSummary?.engine).toBe("jev-shadow")
    expect(enriched.decisionSummary?.agreementRate).toBe(100)
    expect(enriched.rounds[0]?.decision?.comparison?.agree).toBe(true)
  })
})

describe("decision engine factory", () => {
  it("defaults to rules and falls back when the jev key is missing", () => {
    const rules = createDecisionEngine(makeConfig())
    expect(rules.name).toBe("rules")

    const noKey = createDecisionEngine(makeConfig({ ANALYSIS_ENGINE: "jev" }))
    expect(noKey.name).toBe("rules")
  })
})
