import { RoundReplayList } from "@/components/round-replay-list"
import { formatKoreanDateTime } from "@/lib/valorant/date-format"
import type { RoundMatchReport } from "@/lib/valorant/types"

type MatchContributionListProps = {
  readonly matches: readonly RoundMatchReport[]
}

export function MatchContributionList({ matches }: MatchContributionListProps) {
  return (
    <section className="match-contribution-list">
      <div className="review-head">
        <h4>경기당 기여 분석</h4>
        <span>{matches.length}경기</span>
      </div>
      <div className="match-impact-grid">
        {matches.map((match, index) => (
          <article className="match-impact-card" key={match.matchId}>
            <div className="match-impact-head">
              <div>
                <span className="review-kicker">
                  Match {index + 1} · {match.rounds.length}R
                </span>
                <h5>{match.mapName}</h5>
                <p className="match-impact-date">{formatKoreanDateTime(match.startedAt)}</p>
              </div>
              <strong className={`impact-badge ${impactClass(match.impactLabel)}`}>
                {match.impactLabel}
              </strong>
            </div>
            <div className="match-scoreline">
              <strong>
                {match.wins}승 {match.losses}패
              </strong>
              <span>
                {match.kills}K / {match.assists}A / {match.damage}Dmg
              </span>
            </div>
            <dl className="match-impact-metrics">
              <Metric label="기여점수" value={match.averageContributionScore} />
              <Metric label="KAST" value={`${match.kastRate}%`} />
              <Metric label="생존" value={`${match.survivalRate}%`} />
              <Metric label="트레이드" value={`${match.tradeRate}%`} />
              <Metric label="첫 킬" value={match.firstBloods} />
              <Metric label="미교환" value={match.untradedDeaths} />
            </dl>
            <ul className="match-summary-list">
              {match.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <details className="match-round-proof">
              <summary>근거 라운드 보기</summary>
              <RoundReplayList
                rounds={match.rounds.filter((round) => round.reviewPriority !== "low").slice(0, 5)}
              />
            </details>
          </article>
        ))}
      </div>
    </section>
  )
}

function Metric({ label, value }: { readonly label: string; readonly value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function impactClass(label: RoundMatchReport["impactLabel"]): string {
  switch (label) {
    case "강한 기여":
      return "strong"
    case "보통 기여":
      return "steady"
    case "낮은 기여":
      return "low"
  }
}
