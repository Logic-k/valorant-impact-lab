"use client"

import { Html, Line, OrbitControls, PointerLockControls, useTexture } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { type ComponentRef, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, MathUtils, SRGBColorSpace } from "three"

import { gameToMapFraction, type MapAsset } from "@/lib/valorant/assets"
import type { RoundMapEvent } from "@/lib/valorant/types"

const BOARD_SIZE = 10
const BOARD_BOUND = BOARD_SIZE / 2 + 0.4
const MARKER_HEIGHT = 0.34
const WALL_HEIGHT = 1.0
const WALL_SEGMENTS = 224
const DISPLACEMENT_SIZE = 512
const EYE_HEIGHT = 0.75
const ORBIT_CAMERA_POSITION: [number, number, number] = [0, 11, 8.5]

const KIND_COLORS = {
  kill: "#ff5c6c",
  death: "#ece8e1",
  assist: "#5fd38e",
  plant: "#f0c36a",
  defuse: "#7aa2ff",
} as const satisfies Record<RoundMapEvent["kind"], string>

const SUPER_REGION_META: Record<string, { readonly text: string; readonly color: string }> = {
  A: { color: "#ffd166", text: "A" },
  B: { color: "#5fd3e6", text: "B" },
  C: { color: "#c77dff", text: "C" },
  Mid: { color: "#8fa3bd", text: "MID" },
  "Attacker Side": { color: "#ff8a80", text: "공격 스폰" },
  "Defender Side": { color: "#90b8ff", text: "수비 스폰" },
}

const SITE_RINGS = new Set(["A", "B", "C"])

type MapTacticalBoardProps = {
  readonly events: readonly RoundMapEvent[]
  readonly mapAsset: MapAsset
  readonly rotation: number
}

export function MapTacticalBoard({ events, mapAsset, rotation }: MapTacticalBoardProps) {
  const [pov, setPov] = useState(false)
  const [showCallouts, setShowCallouts] = useState(false)
  const textureUrl = mapAsset.displayIcon
  if (textureUrl === undefined) {
    return null
  }
  return (
    <>
      <Canvas camera={{ fov: 55, position: ORBIT_CAMERA_POSITION }} dpr={[1, 2]}>
        <color args={["#0b1219"]} attach="background" />
        <CameraReset pov={pov} />
        <Suspense fallback={null}>
          <BoardScene
            events={events}
            mapAsset={mapAsset}
            rotation={rotation}
            showCallouts={showCallouts}
            textureUrl={textureUrl}
          />
        </Suspense>
        {pov ? (
          <PovControls />
        ) : (
          <OrbitControls
            dampingFactor={0.08}
            enableDamping
            makeDefault
            maxDistance={26}
            maxPolarAngle={Math.PI / 2.15}
            minDistance={4}
          />
        )}
      </Canvas>
      <div className="map-3d-controls">
        <button
          aria-pressed={pov}
          className={`map-view-toggle${pov ? " on" : ""}`}
          onClick={() => setPov((value) => !value)}
          type="button"
        >
          {pov ? "전술 뷰" : "POV 입장"}
        </button>
        <button
          aria-pressed={showCallouts}
          className={`map-view-toggle${showCallouts ? " on" : ""}`}
          onClick={() => setShowCallouts((value) => !value)}
          type="button"
        >
          콜아웃
        </button>
      </div>
      {pov ? (
        <p className="map-3d-pov-hint">캔버스 클릭 → 마우스 시점 · WASD 이동 · ESC 해제</p>
      ) : null}
    </>
  )
}

function CameraReset({ pov }: { readonly pov: boolean }) {
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    if (!pov) {
      camera.position.set(...ORBIT_CAMERA_POSITION)
      camera.lookAt(0, 0, 0)
    }
  }, [pov, camera])
  return null
}

function PovControls() {
  const controlsRef = useRef<ComponentRef<typeof PointerLockControls>>(null)
  const keys = useRef(new Set<string>())
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    camera.position.set(0, EYE_HEIGHT, BOARD_SIZE * 0.6)
    camera.lookAt(0, EYE_HEIGHT, 0)
  }, [camera])

  useEffect(() => {
    const down = (event: KeyboardEvent) => keys.current.add(event.code)
    const up = (event: KeyboardEvent) => keys.current.delete(event.code)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (controls === null || !controls.isLocked) {
      return
    }
    const step = delta * 4.5
    if (keys.current.has("KeyW")) {
      controls.moveForward(step)
    }
    if (keys.current.has("KeyS")) {
      controls.moveForward(-step)
    }
    if (keys.current.has("KeyA")) {
      controls.moveRight(-step)
    }
    if (keys.current.has("KeyD")) {
      controls.moveRight(step)
    }
    camera.position.x = MathUtils.clamp(camera.position.x, -BOARD_BOUND, BOARD_BOUND)
    camera.position.z = MathUtils.clamp(camera.position.z, -BOARD_BOUND, BOARD_BOUND)
    camera.position.y = EYE_HEIGHT
  })

  return <PointerLockControls makeDefault ref={controlsRef} />
}

function BoardScene({
  events,
  mapAsset,
  rotation,
  showCallouts,
  textureUrl,
}: {
  readonly events: readonly RoundMapEvent[]
  readonly mapAsset: MapAsset
  readonly rotation: number
  readonly showCallouts: boolean
  readonly textureUrl: string
}) {
  const texture = useTexture(textureUrl)
  useMemo(() => {
    texture.colorSpace = SRGBColorSpace
  }, [texture])
  const displacement = useMemo(() => buildDisplacementMap(texture.image), [texture])

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

  const regions = useMemo(() => regionLabels(mapAsset), [mapAsset])
  const callouts = useMemo(
    () =>
      (mapAsset.callouts ?? []).map((callout) => ({
        key: `${callout.regionName}-${callout.x}-${callout.y}`,
        label: callout.regionName,
        position: boardPosition(mapAsset, callout.x, callout.y),
      })),
    [mapAsset],
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
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE, WALL_SEGMENTS, WALL_SEGMENTS]} />
        <meshStandardMaterial
          displacementBias={0}
          displacementMap={displacement ?? null}
          displacementScale={WALL_HEIGHT}
          map={texture}
        />
      </mesh>
      {regions.map((region) => (
        <group key={region.key} position={region.position}>
          {SITE_RINGS.has(region.key) ? (
            <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.55, 0.68, 40]} />
              <meshBasicMaterial color={region.color} opacity={0.5} transparent />
            </mesh>
          ) : null}
          <Html center distanceFactor={15} position={[0, 1.9, 0]}>
            <div className="map-3d-site" style={{ borderColor: region.color, color: region.color }}>
              {region.text}
            </div>
          </Html>
        </group>
      ))}
      {showCallouts
        ? callouts.map((callout) => (
            <Html
              center
              distanceFactor={22}
              key={callout.key}
              position={[callout.position[0], 1.05, callout.position[2]]}
            >
              <div className="map-3d-callout">{callout.label}</div>
            </Html>
          ))
        : null}
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
      <MarkerShape hovered={hovered} kind={event.kind} />
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

function regionLabels(
  mapAsset: MapAsset,
): { key: string; color: string; position: [number, number, number]; text: string }[] {
  const groups = new Map<string, { x: number; y: number }[]>()
  for (const callout of mapAsset.callouts ?? []) {
    const key = callout.superRegionName
    if (key === undefined) {
      continue
    }
    groups.set(key, [...(groups.get(key) ?? []), { x: callout.x, y: callout.y }])
  }
  const labels: { key: string; color: string; position: [number, number, number]; text: string }[] =
    []
  for (const [key, points] of groups) {
    const meta = SUPER_REGION_META[key]
    if (meta === undefined || points.length === 0) {
      continue
    }
    const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length
    const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length
    labels.push({
      color: meta.color,
      key,
      position: boardPosition(mapAsset, cx, cy),
      text: meta.text,
    })
  }
  return labels
}

function buildDisplacementMap(image: unknown): CanvasTexture | undefined {
  if (!(image instanceof HTMLImageElement)) {
    return undefined
  }
  const canvas = document.createElement("canvas")
  canvas.width = DISPLACEMENT_SIZE
  canvas.height = DISPLACEMENT_SIZE
  const ctx = canvas.getContext("2d")
  if (ctx === null) {
    return undefined
  }
  ctx.filter = "blur(3px)"
  ctx.drawImage(image, 0, 0, DISPLACEMENT_SIZE, DISPLACEMENT_SIZE)
  const pixels = ctx.getImageData(0, 0, DISPLACEMENT_SIZE, DISPLACEMENT_SIZE)
  const FLOOR_CUTOFF = 95
  for (let i = 0; i < pixels.data.length; i += 4) {
    const alpha = (pixels.data[i + 3] ?? 0) / 255
    const luminance =
      (((pixels.data[i] ?? 0) + (pixels.data[i + 1] ?? 0) + (pixels.data[i + 2] ?? 0)) / 3) * alpha
    const height = luminance <= FLOOR_CUTOFF ? 0 : Math.min(255, (luminance - FLOOR_CUTOFF) * 3.2)
    pixels.data[i] = height
    pixels.data[i + 1] = height
    pixels.data[i + 2] = height
    pixels.data[i + 3] = 255
  }
  ctx.putImageData(pixels, 0, 0)
  return new CanvasTexture(canvas)
}

function boardPosition(mapAsset: MapAsset, x: number, y: number): [number, number, number] {
  const { u, v } = gameToMapFraction(mapAsset, x, y)
  return [(u - 0.5) * BOARD_SIZE, 0, (v - 0.5) * BOARD_SIZE]
}
