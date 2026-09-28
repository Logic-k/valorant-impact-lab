"use client"

import { Html, Line, OrbitControls, useTexture } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { Suspense, useMemo, useState } from "react"
import { SRGBColorSpace } from "three"

import { gameToMapFraction, type MapAsset } from "@/lib/valorant/assets"
import type { RoundMapEvent } from "@/lib/valorant/types"

const BOARD_SIZE = 10
const MARKER_HEIGHT = 0.34

const KIND_COLORS = {
  kill: "#ff5c6c",
  death: "#ece8e1",
  assist: "#5fd38e",
  plant: "#f0c36a",
  defuse: "#7aa2ff",
} as const satisfies Record<RoundMapEvent["kind"], string>

type MapTacticalBoardProps = {
  readonly events: readonly RoundMapEvent[]
  readonly mapAsset: MapAsset
  readonly rotation: number
}

export function MapTacticalBoard({ events, mapAsset, rotation }: MapTacticalBoardProps) {
  const textureUrl = mapAsset.displayIcon
  if (textureUrl === undefined) {
    return null
  }
  return (
    <Canvas camera={{ fov: 45, position: [0, 11, 8.5] }} dpr={[1, 2]}>
      <color args={["#0b1219"]} attach="background" />
      <Suspense fallback={null}>
        <BoardScene
          events={events}
          mapAsset={mapAsset}
          rotation={rotation}
          textureUrl={textureUrl}
        />
      </Suspense>
      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        makeDefault
        maxDistance={26}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={4}
      />
    </Canvas>
  )
}

function BoardScene({
  events,
  mapAsset,
  rotation,
  textureUrl,
}: {
  readonly events: readonly RoundMapEvent[]
  readonly mapAsset: MapAsset
  readonly rotation: number
  readonly textureUrl: string
}) {
  const texture = useTexture(textureUrl)
  useMemo(() => {
    texture.colorSpace = SRGBColorSpace
  }, [texture])

  const placed = useMemo(
    () =>
      events.map((event) => ({
        event,
        key: `${event.matchId}-${event.round}-${event.kind}-${event.x}-${event.y}`,
        position: boardPosition(mapAsset, event.x, event.y),
      })),
    [events, mapAsset],
  )

  const trajectories = useMemo(
    () =>
      placed.flatMap(({ event, key, position }) => {
        if (event.originX === undefined || event.originY === undefined) {
          return []
        }
        const from = boardPosition(mapAsset, event.originX, event.originY)
        const mid: [number, number, number] = [
          (from[0] + position[0]) / 2,
          1.5,
          (from[2] + position[2]) / 2,
        ]
        return [
          {
            color: KIND_COLORS[event.kind],
            key: `${key}-traj`,
            points: [
              [from[0], MARKER_HEIGHT, from[2]],
              mid,
              [position[0], MARKER_HEIGHT, position[2]],
            ] as [number, number, number][],
          },
        ]
      }),
    [placed, mapAsset],
  )

  return (
    <group rotation={[0, (rotation * Math.PI) / 180, 0]}>
      <ambientLight intensity={0.9} />
      <directionalLight intensity={1.3} position={[6, 12, 4]} />
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[BOARD_SIZE + 0.5, 0.5, BOARD_SIZE + 0.5]} />
        <meshStandardMaterial color="#101a26" />
      </mesh>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      {trajectories.map((trajectory) => (
        <Line
          color={trajectory.color}
          key={trajectory.key}
          lineWidth={1.6}
          opacity={0.55}
          points={trajectory.points}
          transparent
        />
      ))}
      {placed.map(({ event, key, position }) => (
        <EventMarker event={event} key={key} position={position} />
      ))}
    </group>
  )
}

function EventMarker({
  event,
  position,
}: {
  readonly event: RoundMapEvent
  readonly position: [number, number, number]
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <group
      onPointerOut={() => setHovered(false)}
      onPointerOver={(hit) => {
        hit.stopPropagation()
        setHovered(true)
      }}
      position={position}
    >
      <MarkerShape kind={event.kind} hovered={hovered} />
      {hovered ? (
        <Html center distanceFactor={14} position={[0, 1.05, 0]}>
          <div className="map-3d-tooltip">{event.label}</div>
        </Html>
      ) : null}
    </group>
  )
}

function MarkerMaterial({ color, hovered }: { readonly color: string; readonly hovered: boolean }) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={hovered ? 1.1 : 0.45}
      roughness={0.5}
    />
  )
}

function MarkerShape({
  hovered,
  kind,
}: {
  readonly hovered: boolean
  readonly kind: RoundMapEvent["kind"]
}) {
  const color = KIND_COLORS[kind]
  switch (kind) {
    case "kill":
      return (
        <mesh position={[0, MARKER_HEIGHT, 0]}>
          <sphereGeometry args={[0.17, 20, 20]} />
          <MarkerMaterial color={color} hovered={hovered} />
        </mesh>
      )
    case "death":
      return (
        <group>
          <mesh position={[0, MARKER_HEIGHT, 0]} rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[0.46, 0.07, 0.11]} />
            <MarkerMaterial color={color} hovered={hovered} />
          </mesh>
          <mesh position={[0, MARKER_HEIGHT, 0]} rotation={[0, -Math.PI / 4, 0]}>
            <boxGeometry args={[0.46, 0.07, 0.11]} />
            <MarkerMaterial color={color} hovered={hovered} />
          </mesh>
        </group>
      )
    case "assist":
      return (
        <mesh position={[0, MARKER_HEIGHT + 0.14, 0]}>
          <coneGeometry args={[0.2, 0.42, 3]} />
          <MarkerMaterial color={color} hovered={hovered} />
        </mesh>
      )
    case "plant":
      return (
        <mesh position={[0, MARKER_HEIGHT + 0.1, 0]}>
          <octahedronGeometry args={[0.24]} />
          <MarkerMaterial color={color} hovered={hovered} />
        </mesh>
      )
    case "defuse":
      return (
        <mesh position={[0, MARKER_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.06, 12, 32]} />
          <MarkerMaterial color={color} hovered={hovered} />
        </mesh>
      )
  }
}

function boardPosition(mapAsset: MapAsset, x: number, y: number): [number, number, number] {
  const { u, v } = gameToMapFraction(mapAsset, x, y)
  return [(u - 0.5) * BOARD_SIZE, 0, (v - 0.5) * BOARD_SIZE]
}
