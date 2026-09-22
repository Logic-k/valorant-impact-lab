import type { PentagonScore } from "@/lib/valorant/types"

type RadarChartProps = {
  readonly scores: PentagonScore
}

const AXES = [
  ["전투", "combat"],
  ["생존", "survival"],
  ["유틸", "utility"],
  ["통제", "control"],
  ["진입", "entry"],
] as const

const SIZE = 240
const CENTER = SIZE / 2
const RADIUS = 88
const RINGS = [0.25, 0.5, 0.75, 1]

export function RadarChart({ scores }: RadarChartProps) {
  const vertex = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / AXES.length
    const radius = (Math.min(Math.max(value, 0), 100) / 100) * RADIUS
    return [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius] as const
  }

  const ringPath = (ratio: number) =>
    AXES.map((_, index) => vertex(index, ratio * 100).join(",")).join(" ")

  const scorePath = AXES.map(([, key], index) => vertex(index, scores[key]).join(",")).join(" ")

  return (
    <div className="radar">
      <svg role="img" viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <title>5축 퍼포먼스 레이더</title>
        {RINGS.map((ratio) => (
          <polygon className="radar-ring" key={ratio} points={ringPath(ratio)} />
        ))}
        {AXES.map(([, key], index) => {
          const [x, y] = vertex(index, 100)
          return <line className="radar-axis" key={key} x1={CENTER} y1={CENTER} x2={x} y2={y} />
        })}
        <polygon className="radar-score" points={scorePath} />
        {AXES.map(([, key], index) => {
          const [x, y] = vertex(index, scores[key])
          return <circle className="radar-vertex" cx={x} cy={y} key={key} r={3.5} />
        })}
        {AXES.map(([label, key], index) => {
          const [x, y] = vertex(index, 118)
          return (
            <text className="radar-label" key={key} textAnchor="middle" x={x} y={y}>
              {label} {scores[key]}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
