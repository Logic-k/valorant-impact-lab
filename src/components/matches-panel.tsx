import { CalendarDays, TrendingUp } from "lucide-react"
import Image from "next/image"

import { teamLuckLabel } from "@/lib/valorant/analysis"
import { agentAssetFor, mapAssetFor, type ValorantAssets } from "@/lib/valorant/assets"
import { formatKoreanDateTime } from "@/lib/valorant/date-format"
import type { MatchDigest } from "@/lib/valorant/types"

type MatchesPanelProps = {
  readonly matches: readonly MatchDigest[]
  readonly assets: ValorantAssets
}

export function MatchesPanel({ matches, assets }: MatchesPanelProps) {
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
          RR 칩은 현재 MMR의 최신 경기 변화량만 표시됩니다. 경기별 RR 증감은 개요 탭의 RR 추이
          차트에서 확인하세요.
        </p>
      </div>
      <div className="match-list">
        {matches.map((match) => (
          <MatchCard assets={assets} key={match.id} match={match} />
        ))}
      </div>
    </div>
  )
}

function MatchCard({
  match,
  assets,
}: {
  readonly match: MatchDigest
  readonly assets: ValorantAssets
}) {
  const resultLabel = match.result === "win" ? "승리" : "패배"
  const mapAsset = mapAssetFor(assets.maps, match.mapName)
  const agentAsset = agentAssetFor(assets.agents, match.agent)
  return (
    <article className={`match-card ${match.result}`}>
      {mapAsset?.splash === undefined ? null : (
        <div className="match-splash" aria-hidden="true">
          <Image
            alt=""
            fill
            sizes="(max-width: 960px) 100vw, 1180px"
            src={mapAsset.splash}
            unoptimized
          />
        </div>
      )}
      <div className="match-card-main">
        <p className="match-date">
          <CalendarDays size={15} aria-hidden="true" />
          {formatKoreanDateTime(match.startedAt)}
        </p>
        <div className="match-title-row">
          <div>
            <p className="match-meta">
              {match.mapName} · {match.mode}
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
        <p className="match-agent-line">
          {agentAsset?.displayIcon === undefined ? null : (
            <Image
              alt={match.agent}
              className="agent-icon"
              height={34}
              src={agentAsset.displayIcon}
              unoptimized
              width={34}
            />
          )}
          {match.narrative}
        </p>
        {match.roundOutcomes === undefined || match.roundOutcomes.length === 0 ? null : (
          <RoundStrip outcomes={match.roundOutcomes} />
        )}
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

function RoundStrip({ outcomes }: { readonly outcomes: readonly ("win" | "loss")[] }) {
  const wins = outcomes.filter((outcome) => outcome === "win").length
  return (
    <div className="round-strip-wrap">
      <div
        className="round-strip"
        role="img"
        aria-label={`라운드 ${wins}승 ${outcomes.length - wins}패`}
      >
        {outcomes.map((outcome, index) => (
          <span
            className={`round-cell ${outcome}`}
            // biome-ignore lint/suspicious/noArrayIndexKey: 라운드 번호(인덱스) 자체가 고정된 식별자
            key={`r${index}`}
            title={`R${index + 1} ${outcome === "win" ? "승" : "패"}`}
          />
        ))}
      </div>
      <span className="round-strip-label">
        라운드 {wins}–{outcomes.length - wins}
      </span>
    </div>
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
