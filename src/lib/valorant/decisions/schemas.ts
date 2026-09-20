import type { DecisionQuestion } from "@/lib/valorant/decisions/engine"
import type { RoundReport } from "@/lib/valorant/types"

export const ROUND_REASON_KEY = "round_reason"
export const ROUND_TIER_KEY = "contribution_tier"
export const ROUND_REVIEW_KEY = "needs_review"

export const TIER_LABELS = ["저기여", "보통", "고기여"] as const

export const ROUND_REASON_CRITERIA = {
  "고기여 패배": "팀은 라운드를 졌지만 이 플레이어의 킬·데미지·생존 기여가 비정상적으로 컸다",
  "첫 데스 후 미교환": "이 플레이어가 라운드 첫 사망자였고 팀이 그 데스를 교환하지 못했다",
  "고비용 언트레이드 데스": "비싼 장비를 보유한 채 사망했고 교환되지 않아 경제 손실이 컸다",
  "첫 킬로 라운드 개입": "이 플레이어가 라운드 첫 킬을 만들어 교전을 열었다",
  "저기여 승리": "팀은 이겼지만 이 플레이어의 기여가 작았다",
  "사망 후 교환 성공": "이 플레이어가 사망했지만 팀이 5초 내 교환에 성공했다",
  "안정 라운드": "특별한 사건 없이 무난하게 끝난 라운드",
} as const

export function roundQuestions(): readonly DecisionQuestion[] {
  return [
    {
      kind: "choice",
      key: ROUND_REASON_KEY,
      instructions:
        "라운드 상태를 보고, 이 플레이어의 라운드를 가장 잘 설명하는 판정 유형 하나를 고른다",
      criteria: ROUND_REASON_CRITERIA,
    },
    {
      kind: "score",
      key: ROUND_TIER_KEY,
      instructions: "이 플레이어가 라운드 승패에 미친 기여 수준을 평가한다",
      levels: [
        "저기여: 승패에 거의 영향이 없었다",
        "보통: 평균적인 수준의 기여를 했다",
        "고기여: 라운드 결과를 사실상 좌우했다",
      ],
    },
    {
      kind: "noul",
      key: ROUND_REVIEW_KEY,
      instructions:
        "이 라운드는 실수·고기여 패배·클러치 같은 예외 상황을 포함해 플레이어가 복기할 가치가 있다",
    },
  ]
}

export function roundState(round: RoundReport): string {
  const flags = [
    round.survived ? "생존" : "사망",
    round.traded ? "교환됨" : null,
    round.firstBlood ? "첫 킬" : null,
    round.firstDeath ? "첫 데스" : null,
    round.untradedDeath ? "미교환 사망" : null,
    round.clutchAttempt ? "클러치 시도" : null,
    round.clutchWin ? "클러치 성공" : null,
    round.kast ? "KAST 달성" : "KAST 실패",
  ].filter((flag) => flag !== null)
  return [
    `맵 ${round.mapName} / 라운드 ${round.round} / 결과 ${round.result === "win" ? "승리" : "패배"}`,
    `기록: ${round.kills}킬 ${round.assists}어시 ${round.damage}딜 점수${round.score}`,
    `경제: 로드아웃 ${round.loadoutValue} / 소비 ${round.spent} / 잔여 ${round.remaining} / 무기 ${round.weaponName} / 방어구 ${round.armorName}`,
    `상태: ${flags.join(", ")}`,
  ].join("\n")
}

export function tierLabelForScore(score: number): string {
  const index = Math.min(Math.max(Math.round(score), 0), TIER_LABELS.length - 1)
  return TIER_LABELS[index] ?? "보통"
}
