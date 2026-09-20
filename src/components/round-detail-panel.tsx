import { MatchContributionList } from "@/components/match-contribution-list"
import type { RoundDetailInsights } from "@/lib/valorant/types"

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
        <RoundMetric label="언트레이드" value={details.untradedDeaths} />
      </div>
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
