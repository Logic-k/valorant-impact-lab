import ky from "ky"
import { z } from "zod"

import type {
  DecisionAnswer,
  DecisionEngine,
  DecisionInput,
  DecisionQuestion,
} from "@/lib/valorant/decisions/engine"

const JevAnswerSchema = z.object({
  type: z.enum(["choice", "score", "noul"]),
  choice: z.string().optional(),
  score: z.number().optional(),
  noul: z.number().optional(),
  confidence: z.number().optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
})

const JevResponseSchema = z.object({
  model: z.string().optional(),
  answers: z.record(z.string(), JevAnswerSchema),
})

export type JevTransport = (payload: Record<string, unknown>) => Promise<unknown>

export type JevEngineConfig = {
  readonly apiKey: string
  readonly baseUrl: string
  readonly model: string
  readonly transport?: JevTransport
}

export class JevEngine implements DecisionEngine {
  readonly name = "jev" as const
  private readonly model: string
  private readonly transport: JevTransport

  constructor(config: JevEngineConfig) {
    this.model = config.model
    this.transport = config.transport ?? createHttpTransport(config)
  }

  async decide(
    input: DecisionInput,
    questions: readonly DecisionQuestion[],
  ): Promise<readonly DecisionAnswer[]> {
    const payload = {
      state: input.state,
      model: this.model,
      questions: toPayloadQuestions(questions),
    }
    const response = JevResponseSchema.parse(await this.transport(payload))
    return questions.map((question) => toAnswer(question, response.answers[question.key]))
  }
}

function createHttpTransport(config: JevEngineConfig): JevTransport {
  const client = ky.create({
    prefixUrl: config.baseUrl.replace(/\/$/, ""),
    headers: { Authorization: `Bearer ${config.apiKey}` },
    retry: { limit: 1, statusCodes: [408, 500, 502, 503, 504] },
    timeout: 5000,
  })
  return (payload) => client.post("v1/systemone", { json: payload }).json()
}

function toPayloadQuestions(questions: readonly DecisionQuestion[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const question of questions) {
    switch (question.kind) {
      case "choice":
        payload[question.key] = {
          type: "choice",
          instructions: question.instructions,
          criteria: question.criteria,
        }
        break
      case "score":
        payload[question.key] = {
          type: "score",
          instructions: question.instructions,
          criteria: question.levels,
        }
        break
      case "noul":
        payload[question.key] = { type: "noul", instructions: question.instructions }
        break
    }
  }
  return payload
}

function toAnswer(
  question: DecisionQuestion,
  answer: z.infer<typeof JevAnswerSchema> | undefined,
): DecisionAnswer {
  if (answer === undefined) {
    return { key: question.key, confidence: 0 }
  }
  switch (question.kind) {
    case "choice":
      return {
        key: question.key,
        choice: answer.choice ?? "",
        confidence: clamp01(answer.confidence ?? 0),
      }
    case "score":
      return {
        key: question.key,
        score: answer.score ?? 0,
        confidence: clamp01(answer.confidence ?? 0),
      }
    case "noul":
      return { key: question.key, noul: clamp01(answer.noul ?? 0), confidence: 0.8 }
  }
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}
