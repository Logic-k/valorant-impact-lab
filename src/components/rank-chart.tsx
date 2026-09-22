"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { RankPoint } from "@/lib/valorant/types"

type RankChartProps = {
  readonly history: readonly RankPoint[]
}

export function RankChart({ history }: RankChartProps) {
  const points = [...history]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((point) => ({
      ...point,
      label: point.date.slice(0, 10),
    }))

  if (points.length === 0) {
    return (
      <p className="muted-copy">
        저장된 MMR 이력이 없습니다. HenrikDev에 저장된 경쟁전 경기가 쌓이면 표시됩니다.
      </p>
    )
  }

  return (
    <div className="rank-chart">
      <ResponsiveContainer height={220} width="100%">
        <LineChart data={points} margin={{ bottom: 4, left: -18, right: 12, top: 8 }}>
          <CartesianGrid stroke="#2a3a46" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            minTickGap={32}
            stroke="#8b96b0"
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <YAxis domain={[0, 100]} stroke="#8b96b0" tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip content={<RankTooltip />} />
          <Line
            dataKey="rr"
            dot={{ fill: "#ff4655", r: 2.5, strokeWidth: 0 }}
            isAnimationActive={false}
            name="RR"
            stroke="#ff4655"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function RankTooltip({
  active,
  payload,
}: {
  readonly active?: boolean
  readonly payload?: readonly { payload: RankPoint & { label: string } }[]
}) {
  const point = payload?.[0]?.payload
  if (active !== true || point === undefined) {
    return null
  }
  return (
    <div className="rank-tooltip">
      <strong>{point.tier}</strong>
      <span>{point.label}</span>
      <span>
        RR {point.rr} ({point.lastChange >= 0 ? "+" : ""}
        {point.lastChange}){point.mapName === undefined ? "" : ` · ${point.mapName}`}
      </span>
    </div>
  )
}
