"use client"

import Image from "next/image"
import { useMemo, useState } from "react"

import { gameToMapFraction, mapAssetFor, type ValorantAssets } from "@/lib/valorant/assets"
import type { RoundMapEvent } from "@/lib/valorant/types"

type MapEventsPanelProps = {
  readonly events: readonly RoundMapEvent[]
  readonly maps: ValorantAssets["maps"]
}

const KIND_META = {
  kill: { label: "킬", symbol: "●" },
  death: { label: "데스", symbol: "✕" },
  assist: { label: "어시", symbol: "▲" },
  plant: { label: "플랜트", symbol: "◆" },
  defuse: { label: "해제", symbol: "◎" },
} as const satisfies Record<RoundMapEvent["kind"], { label: string; symbol: string }>

const ALL_KINDS = Object.keys(KIND_META) as readonly RoundMapEvent["kind"][]

export function MapEventsPanel({ events, maps }: MapEventsPanelProps) {
  const mapNames = useMemo(() => [...new Set(events.map((event) => event.mapName))], [events])
  const [mapName, setMapName] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<ReadonlySet<RoundMapEvent["kind"]>>(new Set(ALL_KINDS))
  const [roundMax, setRoundMax] = useState<number | null>(null)
  const [mode, setMode] = useState<"scatter" | "heat">("scatter")
  const [rotation, setRotation] = useState(0)

  const activeMap = mapName ?? mapNames[0]
  const mapAsset = activeMap === undefined ? undefined : mapAssetFor(maps, activeMap)
  const visible = events.filter(
    (event) =>
      event.mapName === activeMap &&
      enabled.has(event.kind) &&
      (roundMax === null || event.round <= roundMax),
  )
  const maxRound = Math.max(0, ...events.filter((e) => e.mapName === activeMap).map((e) => e.round))

  if (events.length === 0) {
    return (
      <div className="map-events-empty">
        <p className="muted-copy">
          좌표 데이터가 있는 경기가 아직 없습니다. match detail이 내려오는 경쟁전 경기부터
          표시됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="map-events">
      <div className="map-events-toolbar">
        <label>
          맵
          <select
            onChange={(event) => {
              setMapName(event.target.value)
              setRoundMax(null)
            }}
            value={activeMap}
          >
            {mapNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="map-kind-toggles">
          {ALL_KINDS.map((kind) => (
            <button
              aria-pressed={enabled.has(kind)}
              className={`map-kind-toggle ${kind}${enabled.has(kind) ? " on" : ""}`}
              key={kind}
              onClick={() => {
                const next = new Set(enabled)
                if (next.has(kind)) {
                  next.delete(kind)
                } else {
                  next.add(kind)
                }
                setEnabled(next)
              }}
              type="button"
            >
              {KIND_META[kind].symbol} {KIND_META[kind].label}
            </button>
          ))}
        </div>
        <div className="map-view-toggles">
          <button
            aria-pressed={mode === "scatter"}
            className={`map-view-toggle${mode === "scatter" ? " on" : ""}`}
            onClick={() => setMode("scatter")}
            type="button"
          >
            산점도
          </button>
          <button
            aria-pressed={mode === "heat"}
            className={`map-view-toggle${mode === "heat" ? " on" : ""}`}
            onClick={() => setMode("heat")}
            type="button"
          >
            히트맵
          </button>
          <button
            className="map-view-toggle"
            onClick={() => setRotation((value) => (value + 90) % 360)}
            type="button"
          >
            회전 {rotation}°
          </button>
        </div>
        <label className="map-round-filter">
          라운드 ≤ {roundMax ?? maxRound}
          <input
            max={maxRound}
            min={1}
            onChange={(event) => setRoundMax(Number(event.target.value))}
            type="range"
            value={roundMax ?? maxRound}
          />
        </label>
      </div>
      <div className="minimap-wrap">
        {mapAsset?.displayIcon === undefined ? (
          <div className="minimap-fallback">
            <p className="muted-copy">{activeMap} 미니맵 이미지를 불러오지 못했습니다.</p>
          </div>
        ) : (
          <div className="minimap" style={{ transform: `rotate(${rotation}deg)` }}>
            <Image
              alt={`${activeMap} 미니맵`}
              fill
              sizes="(max-width: 960px) 100vw, 520px"
              src={mapAsset.displayIcon}
              unoptimized
            />
            <svg className="minimap-overlay" preserveAspectRatio="none" viewBox="0 0 100 100">
              <title>{`${activeMap} 이벤트 산점도`}</title>
              <defs>
                <radialGradient id="map-heat-blob">
                  <stop offset="0%" stopColor="rgba(255, 70, 85, 0.5)" />
                  <stop offset="55%" stopColor="rgba(255, 70, 85, 0.15)" />
                  <stop offset="100%" stopColor="rgba(255, 70, 85, 0)" />
                </radialGradient>
              </defs>
              {visible.map((event) => {
                const { u, v } = gameToMapFraction(mapAsset, event.x, event.y)
                const key = `${event.matchId}-${event.round}-${event.kind}-${event.x}-${event.y}`
                if (mode === "heat") {
                  return (
                    <circle cx={u * 100} cy={v * 100} fill="url(#map-heat-blob)" key={key} r={7} />
                  )
                }
                return (
                  <g className={`map-dot ${event.kind}`} key={key}>
                    <circle cx={u * 100} cy={v * 100} r={event.kind === "kill" ? 1.9 : 1.6}>
                      <title>{event.label}</title>
                    </circle>
                  </g>
                )
              })}
            </svg>
          </div>
        )}
        <ul className="map-events-legend">
          {ALL_KINDS.map((kind) => (
            <li className={`legend-${kind}`} key={kind}>
              {KIND_META[kind].symbol} {KIND_META[kind].label}{" "}
              <strong>{visible.filter((event) => event.kind === kind).length}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
