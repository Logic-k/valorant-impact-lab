import { describe, expect, it } from "vitest"
import type { AppConfig } from "@/lib/config"
import { applyProfileDecision, applyRoundDecisions } from "@/lib/valorant/decisions/apply"
import { ComparingEngine } from "@/lib/valorant/decisions/comparing-engine"
import { createDecisionEngine } from "@/lib/valorant/decisions/factory"
import { JevEngine } from "@/lib/valorant/decisions/jev-engine"
import { RulesEngine } from "@/lib/valorant/decisions/rules-engine"
import {
  profileQuestions,
  profileState,
  roundQuestions,
  roundState,
} from "@/lib/valorant/decisions/schemas"
import type {
  MatchDigest,
  PerformanceInsights,
  PlayerProfile,
  RoundDetailInsights,
  RoundReport,
} from "@/lib/valorant/types"

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
    clutchSize: 0,
    openingTeam: "enemy",
    tradeableDeath: false,
    buyType: "eco",
    enemyBuyType: "eco",
    loadoutDelta: 0,
    econRating: 50,
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
    openingDuel: {
      duels: 1,
      successRate: 0,
      participationRate: 100,
      teamFirstKillRounds: 0,
      teamFirstKillConversion: 0,
      teamFirstDeathRounds: 1,
      teamFirstDeathRecovery: 0,
    },
    clutchBreakdown: [],
    buyBreakdown: [],
    tradeableUntradedDeaths: 0,
    econRating: 50,
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

function makeMatch(overrides: Partial<MatchDigest> = {}): MatchDigest {
  return {
    id: `match-${Math.random()}`,
    mapName: "Ascent",
    agent: "Sova",
    mode: "Competitive",
    result: "win",
    score: "13-10",
    acs: 220,
    kills: 18,
    deaths: 14,
    assists: 6,
    kdRatio: 1.29,
    kast: 0,
    adr: 150,
    headshotRate: 20,
    tradeValue: 50,
    entryImpact: 50,
    postPlantImpact: 50,
    teamLuck: 50,
    narrative: "",
    startedAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  }
}

function makeInsights(overrides: Partial<PerformanceInsights> = {}): PerformanceInsights {
  return {
    coverage: {
      storedMatches: 100,
      competitiveMatches: 100,
      rangeLabel: "2026-01-01 ~ 2026-09-01",
      seasonMode: "stored_range",
      limitation: "test",
    },
    impactScore: 62,
    impactLabel: "보통",
    strengths: [],
    risks: [],
    agentBreakdown: [
      {
        name: "Sova",
        matches: 40,
        winRate: 50,
        averageAcs: 213,
        kdRatio: 1.03,
        adr: 144.3,
        headshotRate: 19.6,
        impactScore: 62,
      },
      {
        name: "Fade",
        matches: 20,
        winRate: 57,
        averageAcs: 219,
        kdRatio: 1.09,
        adr: 143.3,
        headshotRate: 19.8,
        impactScore: 65,
      },
    ],
    mapBreakdown: [],
    periodBreakdown: [],
    ...overrides,
  }
}

function makeProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    displayName: "TestPlayer",
    tag: "KR1",
    region: "kr",
    accountLevel: 100,
    rank: "Platinum 2",
    rr: 40,
    source: "mock",
    sourceLabel: "test",
    consentState: "demo",
    summary: {
      matches: 100,
      winRate: 50,
      averageAcs: 214,
      kills: 1800,
      deaths: 1700,
      assists: 530,
      kdRatio: 1.03,
      kast: 0,
      adr: 143.5,
      headshotRate: 19.4,
      teamLuck: 41,
      recentTeamLuck: 41,
    },
    pentagon: { combat: 70, survival: 50, utility: 40, control: 55, entry: 60 },
    insights: makeInsights(),
    roundDetails: makeDetails([]),
    rankHistory: [],
    recentMatches: [
      makeMatch({ result: "win", acs: 260 }),
      makeMatch({ result: "win", acs: 250 }),
      makeMatch({ result: "win", acs: 240 }),
      makeMatch({ result: "loss", acs: 230 }),
      makeMatch({ result: "win", acs: 255 }),
    ],
    ...overrides,
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

describe("profile decisions", () => {
  it("rules engine answers profile questions with relative axes, form, and agent pick", async () => {
    const engine = new RulesEngine()
    const profile = makeProfile()
    const answers = await engine.decide(
      { state: profileState(profile), profile },
      profileQuestions(profile),
    )

    const strong = answers.find((answer) => answer.key === "profile_strong_axis")
    expect(strong?.choice).toBe("데미지 압박")
    const weak = answers.find((answer) => answer.key === "profile_weak_axis")
    expect(weak?.choice).toBe("교전 효율")
    const form = answers.find((answer) => answer.key === "profile_form_trend")
    expect(form?.choice).toBe("상승세")
    const agent = answers.find((answer) => answer.key === "profile_agent_pick")
    expect(agent?.choice).toBe("Fade")
  })

  it("applyProfileDecision attaches a profile decision to insights", async () => {
    const jev = new JevEngine({
      apiKey: "test",
      baseUrl: "https://api.typesafe.ai",
      model: "jev-latest",
      transport: () =>
        Promise.resolve({
          answers: {
            profile_strong_axis: { type: "choice", choice: "팀 연계", confidence: 0.7 },
            profile_weak_axis: { type: "choice", choice: "교전 생산성", confidence: 0.6 },
            profile_form_trend: { type: "choice", choice: "유지", confidence: 0.8 },
            profile_agent_pick: { type: "choice", choice: "Sova", confidence: 0.9 },
          },
        }),
    })
    const engine = new ComparingEngine(jev, new RulesEngine(), "rules")
    const insights = await applyProfileDecision(makeProfile(), engine)

    expect(insights.profileDecision?.engine).toBe("jev-shadow")
    expect(insights.profileDecision?.strongAxis).toBe("데미지 압박")
    expect(insights.profileDecision?.recommendedAgent).toBe("Fade")
    expect(insights.profileDecision?.formShadow).toBe("유지")
    expect(insights.profileDecision?.agentShadow).toBe("Sova")
  })

  it("opens the circuit after repeated jev failures and stops calling the transport", async () => {
    let calls = 0
    const jev = new JevEngine({
      apiKey: "test",
      baseUrl: "https://api.typesafe.ai",
      model: "jev-latest",
      transport: () => {
        calls += 1
        return Promise.reject(new Error("gateway down"))
      },
    })
    const engine = new ComparingEngine(jev, new RulesEngine(), "rules")

    for (let index = 0; index < 7; index += 1) {
      const round = makeRound({ round: index + 1 })
      await engine.decide({ state: roundState(round), round }, QUESTIONS)
    }

    expect(calls).toBe(3)
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
