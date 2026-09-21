import { MatchContributionList } from "@/components/match-contribution-list"
import type { BuyType, RoundDetailInsights } from "@/lib/valorant/types"

const BUY_LABELS: Record<BuyType, string> = {
  eco: "에코",
  semi: "세미/포스",
  full: "풀바이",
}

type RoundDetailPanelProps = {
  readonly details: RoundDetailInsights
}

export function RoundDetailPanel({ details }: RoundDetailPanelProps) {
  return (
    <div className="tab-panel" data-panel="rounds">
      <div className="panel-heading">
        <p className="eyebrow">Match Impact</p>
        <h3>경기당 기여 분석</h3>
        <p>{details.note}</p>
      </div>
      <div className="round-metrics">
        <RoundMetric label="KAST" value={`${details.kastRate}%`} />
        <RoundMetric label="생존률" value={`${details.survivalRate}%`} />
        <RoundMetric label="트레이드" value={`${details.tradeRate}%`} />
        <RoundMetric label="클러치" value={`${details.clutchWins}/${details.clutchAttempts}`} />
        <RoundMetric label="첫 데스" value={details.firstDeaths} />
        <RoundMetric
          label="언트레이드"
          value={`${details.untradedDeaths} (교환 가능 ${details.tradeableUntradedDeaths})`}
        />
      </div>
      <div className="round-metrics">
        <RoundMetric
          label="오프닝 듀얼"
          value={`${details.openingDuel.successRate}% (${details.openingDuel.duels}회)`}
        />
        <RoundMetric label="오프닝 참여" value={`${details.openingDuel.participationRate}%`} />
        <RoundMetric
          label="5v4 전환"
          value={`${details.openingDuel.teamFirstKillConversion}% (${details.openingDuel.teamFirstKillRounds}R)`}
        />
        <RoundMetric
          label="4v5 역전"
          value={`${details.openingDuel.teamFirstDeathRecovery}% (${details.openingDuel.teamFirstDeathRounds}R)`}
        />
        <RoundMetric
          label="클러치 상세"
          value={
            details.clutchBreakdown.length === 0
              ? "-"
              : details.clutchBreakdown
                  .map((entry) => `1v${entry.size} ${entry.wins}/${entry.attempts}`)
                  .join(" · ")
          }
        />
        <RoundMetric label="경제 효율" value={details.econRating} />
      </div>
      {details.buyBreakdown.length === 0 ? null : (
        <div className="round-signal-strip">
          {details.buyBreakdown.map((entry) => (
            <Signal
              key={entry.buyType}
              label={`${BUY_LABELS[entry.buyType]} 승률`}
              value={`${entry.winRate}% (${entry.rounds}R, 미스매치 ${entry.mismatchRounds}R ${entry.mismatchWinRate}%)`}
            />
          ))}
        </div>
      )}
      <div className="round-signal-strip">
        <Signal label="첫 킬" value={details.firstBloods} />
        <Signal label="고기여 패배" value={details.highImpactLosses} />
        <Signal label="저기여 승리" value={details.lowImpactWins} />
        <Signal label="리뷰 후보" value={details.reviewRoundCount} />
        <Signal label="평균 소비" value={details.averageSpent} />
        {details.decisionSummary === undefined ? null : (
          <>
            <Signal label="분석 엔진" value={details.decisionSummary.engine} />
            <Signal
              label="평균 확신도"
              value={`${Math.round(details.decisionSummary.averageConfidence * 100)}%`}
            />
            <Signal label="불확실" value={details.decisionSummary.uncertainRounds} />
            {details.decisionSummary.agreementRate === undefined ? null : (
              <Signal label="규칙 일치율" value={`${details.decisionSummary.agreementRate}%`} />
            )}
          </>
        )}
      </div>
      <MatchContributionList matches={details.matchReports} />
    </div>
  )
}

function RoundMetric({
  label,
  value,
}: {
  readonly label: string
  readonly value: React.ReactNode
}) {
  return (
    <div className="round-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Signal({ label, value }: { readonly label: string; readonly value: React.ReactNode }) {
  return (
    <div className="round-signal">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
