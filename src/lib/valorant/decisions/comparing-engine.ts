import type {
  DecisionAnswer,
  DecisionEngine,
  DecisionEngineName,
  DecisionInput,
  DecisionQuestion,
} from "@/lib/valorant/decisions/engine"

export class ComparingEngine implements DecisionEngine {
  readonly name: DecisionEngineName

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

  private async jevOrFallback(
    input: DecisionInput,
    questions: readonly DecisionQuestion[],
  ): Promise<readonly DecisionAnswer[]> {
    try {
      return await this.jev.decide(input, questions)
    } catch (error) {
      console.warn("[decisions] jev call failed, using rules fallback:", errorMessage(error))
      return this.rules.decide(input, questions)
    }
  }

  private async tryJev(
    input: DecisionInput,
    questions: readonly DecisionQuestion[],
  ): Promise<readonly DecisionAnswer[]> {
    try {
      return await this.jev.decide(input, questions)
    } catch (error) {
      console.warn("[decisions] jev shadow call failed:", errorMessage(error))
      return []
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
