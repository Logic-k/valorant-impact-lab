import { MatchesPanel } from "@/components/matches-panel"
import { RoundDetailPanel } from "@/components/round-detail-panel"
import type { PentagonScore, PerformanceBreakdown, PlayerProfile } from "@/lib/valorant/types"

type ProfileTabsProps = {
  readonly profile: PlayerProfile
}

const TABS = [
  ["overview", "개요"],
  ["agents", "요원"],
  ["maps", "맵"],
  ["periods", "기간"],
  ["rounds", "라운드"],
  ["matches", "경기"],
] as const

export function ProfileTabs({ profile }: ProfileTabsProps) {
  return (
    <section className="tabs panel" aria-label="상세 분석">
      {TABS.map(([id], index) => (
        <input
          className="tab-input"
          defaultChecked={index === 0}
          id={`tab-${id}`}
          key={id}
          name="analysis-tab"
          type="radio"
        />
      ))}
      <div className="tab-labels" role="tablist" aria-label="상세 분석 탭">
        {TABS.map(([id, label]) => (
          <label htmlFor={`tab-${id}`} key={id}>
            {label}
          </label>
        ))}
      </div>
      <div className="tab-panels">
        <OverviewPanel profile={profile} />
        <BreakdownPanel
          id="agents"
          title="요원별 기여도"
          description="픽별 ACS, K/D, ADR, 승률, 통합 기여 점수입니다."
          rows={profile.insights.agentBreakdown}
        />
        <BreakdownPanel
          id="maps"
          title="맵별 성과"
          description="맵마다 교전 생산성과 라운드 전환 성과가 어떻게 달라지는지 봅니다."
          rows={profile.insights.mapBreakdown}
        />
        <BreakdownPanel
          id="periods"
          title="기간별 흐름"
          description="저장 경기 시작일 기준 월별 집계이며 최신 월부터 정렬합니다."
          rows={profile.insights.periodBreakdown}
        />
        <RoundDetailPanel details={profile.roundDetails} />
        <MatchesPanel matches={profile.recentMatches} />
      </div>
    </section>
  )
}

function OverviewPanel({ profile }: ProfileTabsProps) {
  const insights = profile.insights
  return (
    <div className="tab-panel overview-panel" data-panel="overview">
      <div className="impact-summary">
        <p className="eyebrow">Impact Score</p>
        <strong>{insights.impactScore}</strong>
        <span>{insights.impactLabel}</span>
      </div>
      <Pentagon scores={profile.pentagon} />
      <InsightList
        title="강점"
        items={insights.strengths}
        emptyText="뚜렷한 강점 신호가 아직 부족합니다."
      />
      <InsightList
        title="개선 포인트"
        items={insights.risks}
        emptyText="뚜렷한 위험 신호가 아직 없습니다."
      />
      <div className="coverage-note">
        <h4>데이터 범위</h4>
        <p>
          저장 경기 {insights.coverage.storedMatches}개 중 경쟁전{" "}
          {insights.coverage.competitiveMatches}개 · {insights.coverage.rangeLabel}
        </p>
        <p>{insights.coverage.limitation}</p>
      </div>
    </div>
  )
}

function BreakdownPanel({
  id,
  title,
  description,
  rows,
}: {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly rows: readonly PerformanceBreakdown[]
}) {
  return (
    <div className="tab-panel" data-panel={id}>
      <div className="panel-heading">
        <p className="eyebrow">Breakdown</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <BreakdownTable rows={rows} />
    </div>
  )
}

function BreakdownTable({ rows }: { readonly rows: readonly PerformanceBreakdown[] }) {
  return (
    <table className="breakdown-table">
      <thead>
        <tr>
          <th>항목</th>
          <th>경기</th>
          <th>승률</th>
          <th>ACS</th>
          <th>K/D</th>
          <th>ADR</th>
          <th>기여</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <th>
              <span className="breakdown-name">{row.name}</span>
              {row.dateRange === undefined ? null : (
                <small className="breakdown-date">{row.dateRange}</small>
              )}
            </th>
            <td>{row.matches}</td>
            <td>{row.winRate}%</td>
            <td>{row.averageAcs}</td>
            <td>{row.kdRatio}</td>
            <td>{row.adr}</td>
            <td>
              <span className="impact-cell">
                <strong>{row.impactScore}</strong>
                <span className="impact-track" aria-hidden="true">
                  <span style={{ width: `${row.impactScore}%` }} />
                </span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function InsightList({
  title,
  items,
  emptyText,
}: {
  readonly title: string
  readonly items: readonly string[]
  readonly emptyText: string
}) {
  return (
    <div className="insight-list">
      <h4>{title}</h4>
      <ul>
        {(items.length > 0 ? items : [emptyText]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function Pentagon({ scores }: { readonly scores: PentagonScore }) {
  const entries = [
    ["전투", scores.combat],
    ["생존", scores.survival],
    ["유틸", scores.utility],
    ["통제", scores.control],
    ["진입", scores.entry],
  ] as const

  return (
    <div className="pentagon">
      {entries.map(([label, value]) => (
        <div className="bar-row" key={label}>
          <span>{label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${value}%` }} />
          </div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}
