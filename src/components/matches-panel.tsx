import { CalendarDays, TrendingUp } from "lucide-react"

import { teamLuckLabel } from "@/lib/valorant/analysis"
import { formatKoreanDateTime } from "@/lib/valorant/date-format"
import type { MatchDigest } from "@/lib/valorant/types"

type MatchesPanelProps = {
  readonly matches: readonly MatchDigest[]
}

export function MatchesPanel({ matches }: MatchesPanelProps) {
  return (
    <div className="tab-panel" data-panel="matches">
      <div className="panel-heading">
        <p className="eyebrow">Recent Matches</p>
        <h3>최근 경기 리포트</h3>
        <p>
          팀운은 개인 기여 기대치와 승패 결과의 차이를 0-100으로 환산합니다. 높을수록 결과가 개인
          지표보다 좋았고, 낮을수록 개인 지표 대비 결과가 나빴다는 뜻입니다.
        </p>
        <p className="data-note">
          RR은 현재 MMR의 최신 경기 변화량만 확인됩니다. 과거 경기별 RR 증감은 현재 match detail
          응답에 없어 표시하지 않습니다.
        </p>
      </div>
      <div className="match-list">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </div>
  )
}

function MatchCard({ match }: { readonly match: MatchDigest }) {
  const resultLabel = match.result === "win" ? "승리" : "패배"
  return (
    <article className={`match-card ${match.result}`}>
      <div className="match-card-main">
        <p className="match-date">
          <CalendarDays size={15} aria-hidden="true" />
          {formatKoreanDateTime(match.startedAt)}
        </p>
        <div className="match-title-row">
          <div>
            <p className="match-meta">
              {match.mapName} · {match.agent} · {match.mode}
            </p>
            <h4>
              {resultLabel} {match.score}
            </h4>
          </div>
          {match.rrChange === undefined ? null : (
            <span className={`rr-chip ${match.rrChange >= 0 ? "gain" : "loss"}`}>
              <TrendingUp size={14} aria-hidden="true" />
              RR {signed(match.rrChange)}
            </span>
          )}
        </div>
        <p>{match.narrative}</p>
        <div className="team-luck-block">
          <div>
            <span>팀운</span>
            <strong>
              {match.teamLuck} · {teamLuckLabel(match.teamLuck)}
            </strong>
          </div>
          <div className="team-luck-track" aria-hidden="true">
            <span style={{ width: `${match.teamLuck}%` }} />
          </div>
        </div>
      </div>
      <dl>
        <Metric label="ACS" value={match.acs} />
        <Metric label="K/D/A" value={`${match.kills}/${match.deaths}/${match.assists}`} />
        <Metric label="ADR" value={match.adr} />
        <Metric label="HS%" value={`${match.headshotRate}%`} />
      </dl>
    </article>
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

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}
