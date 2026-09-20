import { z } from "zod"

const ConfigSchema = z.object({
  VALORANT_DATA_PROVIDER: z.enum(["mock", "henrik", "riot"]).default("mock"),
  HENRIKDEV_API_KEY: z.string().optional(),
  HENRIKDEV_BASE_URL: z.string().url().default("https://api.henrikdev.xyz"),
  ANALYSIS_ENGINE: z.enum(["rules", "jev", "jev-shadow"]).default("rules"),
  TYPESAFE_API_KEY: z.string().optional(),
  TYPESAFE_BASE_URL: z.string().url().default("https://api.typesafe.ai"),
  TYPESAFE_MODEL: z.string().default("jev-latest"),
  DECISION_MAX_ROUNDS: z.coerce.number().int().min(1).max(500).default(40),
  DECISION_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
})

export type AppConfig = z.infer<typeof ConfigSchema>

export function readConfig(): AppConfig {
  return ConfigSchema.parse({
    VALORANT_DATA_PROVIDER: process.env["VALORANT_DATA_PROVIDER"],
    HENRIKDEV_API_KEY: process.env["HENRIKDEV_API_KEY"],
    HENRIKDEV_BASE_URL: process.env["HENRIKDEV_BASE_URL"],
    ANALYSIS_ENGINE: process.env["ANALYSIS_ENGINE"],
    TYPESAFE_API_KEY: process.env["TYPESAFE_API_KEY"],
    TYPESAFE_BASE_URL: process.env["TYPESAFE_BASE_URL"],
    TYPESAFE_MODEL: process.env["TYPESAFE_MODEL"],
    DECISION_MAX_ROUNDS: process.env["DECISION_MAX_ROUNDS"],
    DECISION_CONCURRENCY: process.env["DECISION_CONCURRENCY"],
  })
}
