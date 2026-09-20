import type { AppConfig } from "@/lib/config"
import { ComparingEngine } from "@/lib/valorant/decisions/comparing-engine"
import type { DecisionEngine } from "@/lib/valorant/decisions/engine"
import { JevEngine } from "@/lib/valorant/decisions/jev-engine"
import { RulesEngine } from "@/lib/valorant/decisions/rules-engine"

export function createDecisionEngine(config: AppConfig): DecisionEngine {
  const rules = new RulesEngine()
  if (config.ANALYSIS_ENGINE === "rules") {
    return rules
  }
  if (config.TYPESAFE_API_KEY === undefined || config.TYPESAFE_API_KEY.length === 0) {
    return rules
  }
  const jev = new JevEngine({
    apiKey: config.TYPESAFE_API_KEY,
    baseUrl: config.TYPESAFE_BASE_URL,
    model: config.TYPESAFE_MODEL,
  })
  return new ComparingEngine(jev, rules, config.ANALYSIS_ENGINE === "jev" ? "jev" : "rules")
}
