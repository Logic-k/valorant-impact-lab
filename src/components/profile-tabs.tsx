import { MapEventsPanel } from "@/components/map-events-panel"
import { MatchesPanel } from "@/components/matches-panel"
import { RadarChart } from "@/components/radar-chart"
import { RankChart } from "@/components/rank-chart"
import { RoundDetailPanel } from "@/components/round-detail-panel"
import type { ValorantAssets } from "@/lib/valorant/assets"
import type { PerformanceBreakdown, PlayerProfile, ProfileDecision } from "@/lib/valorant/types"

type ProfileTabsProps = {
  readonly profile: PlayerProfile
  readonly assets: ValorantAssets
}

const TABS = [
  ["overview", "개요"],
  ["agents", "요원"],
  ["maps", "맵"],
  ["periods", "기간"],
  ["rounds", "라운드"],
  ["mapview", "지도"],
  ["matches", "경기"],
] as const

export function ProfileTabs({ profile, assets }: ProfileTabsProps) {
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
        <div className="tab-panel" data-panel="mapview">
          <div className="panel-heading">
            <p className="eyebrow">Map Events</p>
            <h3>맵 이벤트 뷰</h3>
            <p>match detail에 포함된 킬/데스/어시스트/플랜트/해제 좌표를 미니맵 위에 표시합니다.</p>
          </div>
          <MapEventsPanel events={profile.roundDetails.mapEvents} maps={assets.maps} />
        </div>
        <MatchesPanel assets={assets} matches={profile.recentMatches} />
      </div>
    </section>
  )
}

function OverviewPanel({ profile }: { readonly profile: PlayerProfile }) {
  const insights = profile.insights
  return (
    <div className="tab-panel overview-panel" data-panel="overview">
      <div className="impact-summary">
        <p className="eyebrow">Impact Score</p>
        <strong>{insights.impactScore}</strong>
        <span>{insights.impactLabel}</span>
      </div>
      <div className="insight-list rank-history">
        <h4>RR 추이</h4>
        <RankChart history={profile.rankHistory} />
      </div>
      <RadarChart scores={profile.pentagon} />
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
      {insights.profileDecision === undefined ? null : (
        <ProfileDecisionCard decision={insights.profileDecision} />
      )}
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

function ProfileDecisionCard({ decision }: { readonly decision: ProfileDecision }) {
  const shadowParts = [
    decision.formShadow === undefined ? null : `폼 ${decision.formShadow}`,
    decision.agentShadow === undefined ? null : `요원 ${decision.agentShadow}`,
  ].filter((part) => part !== null)
  const percent = (value: number | undefined) => `${Math.round((value ?? 0) * 100)}%`
  return (
    <div className="insight-list profile-decision">
      <h4>
        AI 판정 <span className="decision-engine">{decision.engine}</span>
      </h4>
      <ul>
        {decision.formTrend === undefined ? null : (
          <li>
            폼 추세: {decision.formTrend} · {percent(decision.formConfidence)}
          </li>
        )}
        {decision.recommendedAgent === undefined ? null : (
          <li>
            집중 추천 요원: {decision.recommendedAgent} · {percent(decision.agentConfidence)}
          </li>
        )}
        {decision.strongAxis === undefined ? null : <li>상대 강점 축: {decision.strongAxis}</li>}
        {decision.weakAxis === undefined ? null : <li>보완 축: {decision.weakAxis}</li>}
        {shadowParts.length === 0 ? null : <li>대조 엔진 판정: {shadowParts.join(" · ")}</li>}
      </ul>
    </div>
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
