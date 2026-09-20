import type {
  DecisionAnswer,
  DecisionEngine,
  DecisionEngineName,
  DecisionInput,
  DecisionQuestion,
} from "@/lib/valorant/decisions/engine"

const CIRCUIT_LIMIT = 3

export class ComparingEngine implements DecisionEngine {
  readonly name: DecisionEngineName
  private consecutiveJevFailures = 0

  constructor(
    private readonly jev: DecisionEngine,
    private readonly rules: DecisionEngine,
    private readonly primary: "jev" | "rules",
  ) {
    this.name = primary === "jev" ? "jev" : "jev-shadow"
  }

  async decide(
    input: DecisionInput,
    questions: readonly DecisionQuestion[],
  ): Promise<readonly DecisionAnswer[]> {
    const [primaryAnswers, shadowAnswers] =
      this.primary === "jev"
        ? [await this.jevOrFallback(input, questions), await this.rules.decide(input, questions)]
        : [await this.rules.decide(input, questions), await this.tryJev(input, questions)]
    return primaryAnswers.map((answer) =>
      mergeShadow(
        answer,
        shadowAnswers.find((shadow) => shadow.key === answer.key),
      ),
    )
  }

  private get jevOpen(): boolean {
    return this.consecutiveJevFailures < CIRCUIT_LIMIT
  }

  private async jevOrFallback(
    input: DecisionInput,
    questions: readonly DecisionQuestion[],
  ): Promise<readonly DecisionAnswer[]> {
    if (!this.jevOpen) {
      return this.rules.decide(input, questions)
    }
    try {
      const answers = await this.jev.decide(input, questions)
      this.consecutiveJevFailures = 0
      return answers
    } catch (error) {
      this.recordFailure("jev call failed, using rules fallback", error)
      return this.rules.decide(input, questions)
    }
  }

  private async tryJev(
    input: DecisionInput,
    questions: readonly DecisionQuestion[],
  ): Promise<readonly DecisionAnswer[]> {
    if (!this.jevOpen) {
      return []
    }
    try {
      const answers = await this.jev.decide(input, questions)
      this.consecutiveJevFailures = 0
      return answers
    } catch (error) {
      this.recordFailure("jev shadow call failed", error)
      return []
    }
  }

  private recordFailure(context: string, error: unknown): void {
    this.consecutiveJevFailures += 1
    console.warn(
      `[decisions] ${context} (${this.consecutiveJevFailures}/${CIRCUIT_LIMIT}):`,
      errorMessage(error),
    )
    if (!this.jevOpen) {
      console.warn("[decisions] jev circuit open — skipping remaining jev calls this run")
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function mergeShadow(answer: DecisionAnswer, shadow: DecisionAnswer | undefined): DecisionAnswer {
  if (shadow?.choice === undefined) {
    return answer
  }
  return { ...answer, shadowChoice: shadow.choice, shadowConfidence: shadow.confidence }
}
