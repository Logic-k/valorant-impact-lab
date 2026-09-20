import {
  Activity,
  AlertTriangle,
  BarChart3,
  Crosshair,
  Database,
  Gauge,
  ShieldCheck,
  Swords,
} from "lucide-react"

import { ProfileTabs } from "@/components/profile-tabs"
import { teamLuckLabel } from "@/lib/valorant/analysis"
import type { PlayerLookup, PlayerProfile } from "@/lib/valorant/types"

type DashboardProps = {
  readonly lookup: PlayerLookup
  readonly profile: PlayerProfile
  readonly providerWarning: string | null
}

const REGION_OPTIONS = ["na", "eu", "kr", "ap", "br", "latam"] as const

export function Dashboard({ lookup, profile, providerWarning }: DashboardProps) {
  return (
    <main className="shell">
      <section className="topbar" aria-label="검색">
        <div>
          <p className="eyebrow">VALORANT Impact Lab</p>
          <h1>임시 HenrikDev 어댑터 기반 퍼포먼스 분석 베타</h1>
        </div>
        <form className="lookup" method="get">
          <label>
            Riot ID
            <input name="name" defaultValue={lookup.name} aria-label="Riot ID 이름" />
          </label>
          <label>
            Tag
            <input name="tag" defaultValue={lookup.tag} aria-label="Riot ID 태그" />
          </label>
          <label>
            Region
            <select name="region" defaultValue={lookup.region} aria-label="지역">
              {REGION_OPTIONS.map((region) => (
                <option key={region} value={region}>
                  {region.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">
            <Crosshair size={16} aria-hidden="true" />
            조회
          </button>
        </form>
      </section>

      {providerWarning === null ? null : (
        <section className="warning" aria-label="provider 상태">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{providerWarning}. Mock fixture로 안전하게 fallback했습니다.</span>
        </section>
      )}

      <section className="identity">
        <div>
          <p className="eyebrow">Player</p>
          <h2>
            {profile.displayName}
            <span>#{profile.tag}</span>
          </h2>
          <p>
            {profile.region.toUpperCase()} · {profile.rank} · {profile.rr} RR
            {profile.rrDelta === undefined ? "" : ` (${signed(profile.rrDelta)} 최근)`} · Lv.
            {profile.accountLevel}
          </p>
        </div>
        <div className="source">
          <Database size={18} aria-hidden="true" />
          <span>{profile.sourceLabel}</span>
        </div>
      </section>

      <section className="metrics" aria-label="요약 지표">
        <Metric icon={<Swords size={18} />} label="AVG ACS" value={profile.summary.averageAcs} />
        <Metric icon={<ShieldCheck size={18} />} label="K/D" value={profile.summary.kdRatio} />
        <Metric icon={<Activity size={18} />} label="ADR" value={profile.summary.adr} />
        <Metric
          icon={<Crosshair size={18} />}
          label="HS%"
          value={`${profile.summary.headshotRate}%`}
        />
        <Metric icon={<BarChart3 size={18} />} label="K / D / A" value={kdaLabel(profile)} />
        <Metric icon={<BarChart3 size={18} />} label="승률" value={`${profile.summary.winRate}%`} />
        <Metric
          icon={<Gauge size={18} />}
          label="최근 8 팀운"
          value={teamLuckValue(profile.summary.recentTeamLuck)}
        />
      </section>

      <ProfileTabs profile={profile} />
    </main>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  readonly icon: React.ReactNode
  readonly label: string
  readonly value: React.ReactNode
}) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function kdaLabel(profile: PlayerProfile): string {
  return `${profile.summary.kills}/${profile.summary.deaths}/${profile.summary.assists}`
}

function teamLuckValue(value: number): string {
  return `${value} · ${teamLuckLabel(value)}`
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}
