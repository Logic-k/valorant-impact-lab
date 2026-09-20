import type { RoundReport, RoundTimelineEvent } from "@/lib/valorant/types"

type RoundReplayListProps = {
  readonly rounds: readonly RoundReport[]
}

export function RoundReplayList({ rounds }: RoundReplayListProps) {
  return (
    <div className="round-replay-list">
      {rounds.map((round) => (
        <details
          className={`round-replay ${round.reviewPriority}`}
          key={`${round.matchId}-${round.round}`}
        >
          <summary>
            <span className="round-number">R{round.round}</span>
            <span className="round-main">
              <strong>
                {round.reviewReason}
                {round.decision === undefined ? null : (
                  <small
                    className={`decision-confidence${
                      round.decision.reasonConfidence < 0.55 ? " uncertain" : ""
                    }`}
                  >
                    {Math.round(round.decision.reasonConfidence * 100)}%
                  </small>
                )}
              </strong>
              <small>
                {round.result === "win" ? "승리" : "패배"} · {openingLabel(round)} ·{" "}
                {survivalLabel(round)}
              </small>
            </span>
            <span className="round-stats">
              {round.kills}/{round.assists}/{round.damage}
            </span>
          </summary>
          <div className="round-replay-body">
            <dl className="round-facts">
              <Fact label="무기" value={round.weaponName} />
              <Fact label="장비값" value={round.loadoutValue} />
              <Fact label="소비" value={round.spent} />
              <Fact
                label="기여점수"
                value={`${round.contributionScore} · ${round.contributionLabel}`}
              />
              {round.decision === undefined ? null : (
                <Fact label="판정" value={decisionLabel(round.decision)} />
              )}
            </dl>
            <Evidence evidence={round.evidence} />
            <Timeline events={round.timeline} />
          </div>
        </details>
      ))}
    </div>
  )
}

function Fact({ label, value }: { readonly label: string; readonly value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function Evidence({ evidence }: { readonly evidence: readonly string[] }) {
  return (
    <section className="round-evidence">
      <h5>판단 근거</h5>
      <ul>
        {evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}

function Timeline({ events }: { readonly events: readonly RoundTimelineEvent[] }) {
  return (
    <section className="round-timeline">
      <h5>라운드 타임라인</h5>
      {events.length === 0 ? (
        <p className="muted-copy">본인과 직접 연결된 킬 로그가 없습니다.</p>
      ) : (
        <ol>
          {events.map((event) => (
            <li className={event.emphasis ? "emphasis" : undefined} key={eventKey(event)}>
              <time>{event.timeLabel}</time>
              <span className={`timeline-kind ${event.kind}`}>{kindLabel(event.kind)}</span>
              <p>{event.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function decisionLabel(decision: NonNullable<RoundReport["decision"]>): string {
  const confidence = `${Math.round(decision.reasonConfidence * 100)}%`
  const comparison = decision.comparison
  if (comparison === undefined) {
    return `${decision.engine} · ${confidence}`
  }
  const other = decision.engine === "jev" ? "규칙" : "Jev"
  const verdict = comparison.agree ? "일치" : `불일치 → ${comparison.reason}`
  return `${decision.engine} · ${confidence} · ${other} ${verdict}`
}

function openingLabel(round: RoundReport): string {
  if (round.firstBlood) {
    return "첫 킬"
  }
  if (round.firstDeath) {
    return "첫 데스"
  }
  return "첫 교전 관망"
}

function survivalLabel(round: RoundReport): string {
  if (round.survived) {
    return "생존"
  }
  if (round.traded) {
    return "교환됨"
  }
  return "미교환 사망"
}

function kindLabel(kind: RoundTimelineEvent["kind"]): string {
  switch (kind) {
    case "opening":
      return "첫교전"
    case "kill":
      return "킬"
    case "death":
      return "데스"
    case "assist":
      return "어시"
    case "trade":
      return "교환"
    case "note":
      return "메모"
  }
}

function eventKey(event: RoundTimelineEvent): string {
  return `${event.timeMs}-${event.kind}-${event.text}`
}
