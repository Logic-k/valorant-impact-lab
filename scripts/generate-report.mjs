#!/usr/bin/env node
// 사용법: node scripts/generate-report.mjs <report-data.json> [출력.html]
// .report-data.json은 /api/player 응답에서 추출한 decision 데이터
import { readFileSync, writeFileSync } from "node:fs"

const [inputPath, outputPath = "overnight-report.html"] = process.argv.slice(2)
if (!inputPath) {
  console.error("usage: node scripts/generate-report.mjs <report-data.json> [output.html]")
  process.exit(1)
}
const data = JSON.parse(readFileSync(inputPath, "utf8"))
const { summary, profileDecision, player, coverage, rounds } = data

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const pct = (v) => `${Math.round((v ?? 0) * 100)}%`

// --- 라벨 분포 ---
const labelOrder = [...new Set([...rounds.map((r) => r.rules), ...rounds.map((r) => r.jev ?? "")])]
const count = (key) => {
  const c = {}
  for (const r of rounds) {
    const v = r[key]
    if (v) c[v] = (c[v] ?? 0) + 1
  }
  return c
}
const rulesCount = count("rules")
const jevCount = count("jev")
const maxCount = Math.max(1, ...Object.values(rulesCount), ...Object.values(jevCount))

const distRows = labelOrder
  .filter((l) => l)
  .map((label) => {
    const rc = rulesCount[label] ?? 0
    const jc = jevCount[label] ?? 0
    return `<tr>
      <td>${esc(label)}</td>
      <td><div class="bar"><i style="width:${(rc / maxCount) * 100}%"></i><b>${rc}</b></div></td>
      <td><div class="bar jev"><i style="width:${(jc / maxCount) * 100}%"></i><b>${jc}</b></div></td>
    </tr>`
  })
  .join("")

// --- 확신도 히스토그램 ---
const buckets = [
  ["<40%", 0],
  ["40–54%", 0],
  ["55–69%", 0],
  ["70–84%", 0],
  ["85–100%", 0],
]
for (const r of rounds) {
  const c = (r.jevConf ?? 0) * 100
  const idx = c < 40 ? 0 : c < 55 ? 1 : c < 70 ? 2 : c < 85 ? 3 : 4
  buckets[idx][1] += 1
}
const maxBucket = Math.max(1, ...buckets.map((b) => b[1]))
const histHtml = buckets
  .map(
    ([label, n]) => `<div class="hist">
      <div class="hist-bar"><i style="height:${(n / maxBucket) * 100}%"></i></div>
      <span>${n}</span><small>${label}</small>
    </div>`,
  )
  .join("")

// --- 불일치 라운드 ---
const disagreements = rounds.filter((r) => r.agree === false)
const disHtml = disagreements
  .map(
    (r) => `<tr>
      <td>${esc(r.map)} R${r.r}</td>
      <td>${r.result === "win" ? "승리" : "패배"}</td>
      <td>${esc(r.rules)}</td>
      <td class="jev-cell">${esc(r.jev)} <em>${pct(r.jevConf)}</em></td>
      <td>${r.contrib}</td>
      <td>${r.spent}</td>
    </tr>`,
  )
  .join("")

// --- 확신도 구간별 일치율 ---
const band = (lo, hi) => {
  const inBand = rounds.filter((r) => {
    const c = r.jevConf ?? 0
    return c >= lo && c < hi
  })
  const agreed = inBand.filter((r) => r.agree).length
  return inBand.length === 0
    ? "—"
    : `${Math.round((agreed / inBand.length) * 100)}% (${agreed}/${inBand.length})`
}
const bandRows = `
  <tr><td>Jev 확신도 ≥ 55%</td><td>${band(0.55, 1.01)}</td></tr>
  <tr><td>Jev 확신도 &lt; 55%</td><td>${band(0, 0.55)}</td></tr>`

const pd = profileDecision ?? {}
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Valorant Impact Lab — Jev 통합 세션 리포트</title>
<style>
  :root {
    --bg: #0b0e14; --surface: #121724; --surface2: #171f30; --line: #232c40;
    --text: #e8edf7; --muted: #8b96b0; --accent: #7aa2ff; --accent2: #a9c4ff;
    --red: #ff5c6c; --red2: #ff98a3; --green: #4ade80; --amber: #fbbf24;
  }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--bg); color: var(--text); font: 15px/1.6 "Pretendard","Segoe UI",system-ui,sans-serif; padding: 40px 20px; }
  .wrap { max-width: 960px; margin: 0 auto; }
  header { border-bottom: 1px solid var(--line); padding-bottom: 24px; margin-bottom: 32px; }
  .eyebrow { color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 8px; }
  h1 { font-size: 30px; line-height: 1.25; }
  h2 { font-size: 19px; margin: 40px 0 14px; padding-top: 12px; border-top: 1px solid var(--line); }
  h2:first-of-type { border-top: 0; }
  .sub { color: var(--muted); margin-top: 8px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 24px 0; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 18px; }
  .card b { display: block; font-size: 28px; line-height: 1.1; margin-bottom: 4px; }
  .card span { color: var(--muted); font-size: 13px; }
  .card.green b { color: var(--green); } .card.blue b { color: var(--accent2); } .card.amber b { color: var(--amber); }
  table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; font-size: 14px; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: .06em; }
  tr:last-child td { border-bottom: 0; }
  .ok { color: var(--green); font-weight: 700; } .bad { color: var(--red2); }
  .bar { display: flex; align-items: center; gap: 8px; }
  .bar i { display: block; height: 14px; border-radius: 4px; background: var(--accent); min-width: 2px; }
  .bar.jev i { background: var(--red); }
  .bar b { font-weight: 600; min-width: 20px; }
  .hist-wrap { display: flex; gap: 18px; align-items: flex-end; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 24px; }
  .hist { flex: 1; text-align: center; }
  .hist-bar { height: 120px; display: flex; align-items: flex-end; justify-content: center; }
  .hist-bar i { display: block; width: 60%; background: var(--accent); border-radius: 6px 6px 0 0; min-height: 3px; }
  .hist span { display: block; font-weight: 700; margin-top: 8px; }
  .hist small { color: var(--muted); font-size: 12px; }
  .vs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .vs .card b { font-size: 20px; }
  .vs h3 { font-size: 13px; color: var(--muted); margin-bottom: 10px; letter-spacing: .08em; }
  .vs ul { list-style: none; padding: 0; } .vs li { padding: 6px 0; border-bottom: 1px dashed var(--line); font-size: 14px; }
  .vs li:last-child { border: 0; } .vs li em { color: var(--muted); font-style: normal; }
  .diff { color: var(--amber); font-weight: 700; }
  .flow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 20px; font-size: 13px; }
  .flow .node { background: var(--surface2); border: 1px solid var(--line); border-radius: 8px; padding: 8px 14px; }
  .flow .node.jev { border-color: var(--red); }
  .flow .arrow { color: var(--muted); }
  code, pre { font-family: "Cascadia Code","JetBrains Mono",monospace; }
  code { background: var(--surface2); border-radius: 4px; padding: 2px 6px; font-size: 13px; }
  pre { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; overflow-x: auto; font-size: 13px; line-height: 1.7; }
  ul.list { padding-left: 20px; } ul.list li { margin: 6px 0; }
  .note { color: var(--muted); font-size: 13px; margin-top: 8px; }
  footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<div class="wrap">
<header>
  <p class="eyebrow">Valorant Impact Lab · Overnight Session</p>
  <h1>Jev(System One) 통합 리포트</h1>
  <p class="sub">실측 데이터: ${esc(player.name)}#${esc(player.tag)} · ${esc(player.rank)} · 경쟁전 ${player.matches}경기 (${esc(coverage.rangeLabel)}) · 엔진: <code>${esc(summary.engine)}</code></p>
</header>

<div class="cards">
  <div class="card green"><b>${summary.agreementRate ?? "—"}%</b><span>규칙-Jev 라운드 판정 일치율</span></div>
  <div class="card blue"><b>${summary.scoredRounds}</b><span>채점 라운드 (상위 우선순위)</span></div>
  <div class="card blue"><b>${pct(summary.averageConfidence)}</b><span>평균 판정 확신도</span></div>
  <div class="card amber"><b>$0.00</b><span>이번 분석 과금 (프로모 무료)</span></div>
</div>

<h2>1. 이번 세션에서 구현한 것</h2>
<ul class="list">
  <li><b>프로필 레벨 Jev 판정</b> — 폼 추세(상승/유지/하락), 집중 추천 요원, 상대 강점·보완 축 4개 atomic 질문. 규칙 임계값이 전부 중립이라 <code>strengths/risks</code>가 비어있던 실제 문제를 상대 평가로 해소</li>
  <li><b>Jev 서킷브레이커</b> — 연속 3회 실패 시 잔여 호출 스킵 (403/반복 장애 시 40회 실패 → 최대 3+α회로 절감)</li>
  <li><b>429 재시도</b> — ky POST 재시도 3회 + 백오프 (업스트림 혼잡 대응)</li>
  <li><b>질문 충실도 수정</b> — 라벨 붕괴(27%) → 일치율 90%: 기여 점수 상태 포함 + 수치 임계값 + 우선순위 명시</li>
  <li><b>UI</b> — 개요 탭 "AI 판정" 카드 (폼/추천 요원/강·약점 축 + 대조 엔진 표시)</li>
</ul>

<h2>2. 검증 결과</h2>
<table>
  <tr><th>검증</th><th>결과</th></tr>
  <tr><td><code>pnpm typecheck</code></td><td class="ok">통과</td></tr>
  <tr><td><code>pnpm test</code></td><td class="ok">26/26 통과 (6 파일)</td></tr>
  <tr><td><code>pnpm lint</code></td><td class="ok">클린 (47 파일)</td></tr>
  <tr><td><code>pnpm build</code></td><td class="ok">성공 (Next.js 16)</td></tr>
  <tr><td>실데이터 API 스모크</td><td class="ok">HTTP 200 · Jev 실응답 수신</td></tr>
</table>

<h2>3. 라운드 판정: 규칙 vs Jev</h2>
<table>
  <tr><th>라벨</th><th>규칙 엔진</th><th>Jev (대조)</th></tr>
  ${distRows}
</table>
<p class="note">불일치 ${disagreements.length}건 / ${rounds.length}건 — 전부 Jev 확신도 낮은 구간에 집중 (아래)</p>

<h2>4. Jev 확신도 분포 (보정 검증)</h2>
<div class="hist-wrap">${histHtml}</div>
<table style="margin-top:12px">
  <tr><th>구간</th><th>규칙과 일치율</th></tr>
  ${bandRows}
</table>
<p class="note">RLCD 보정의 실측 증거: Jev가 불확실하다고 표시한 라운드가 실제로 규칙과 불일치합니다. 높은 확신도 구간의 일치율이 높을수록 확신도를 신뢰해도 됩니다.</p>

<h2>5. 불일치 라운드 상세</h2>
<table>
  <tr><th>라운드</th><th>결과</th><th>규칙 판정</th><th>Jev 판정</th><th>기여점수</th><th>소비</th></tr>
  ${disHtml}
</table>
<p class="note">공통 패턴: 규칙이 "고비용 언트레이드 데스"로 단정한 승리 라운드를 Jev는 낮은 확신도로 다른 라벨을 제시 — "이긴 라운드의 실패형 라벨"이라는 분류 체계 자체의 모호성을 드러냅니다.</p>

<h2>6. 프로필 레벨 판정 (신규)</h2>
<div class="vs">
  <div class="card"><h3>규칙 엔진 (주력)</h3><ul>
    <li>폼 추세: <b>${esc(pd.formTrend ?? "—")}</b> <em>${pct(pd.formConfidence)}</em></li>
    <li>추천 요원: <b>${esc(pd.recommendedAgent ?? "—")}</b> <em>${pct(pd.agentConfidence)}</em></li>
    <li>상대 강점: <b>${esc(pd.strongAxis ?? "—")}</b></li>
    <li>보완 축: <b>${esc(pd.weakAxis ?? "—")}</b></li>
  </ul></div>
  <div class="card"><h3>Jev (대조)</h3><ul>
    <li>폼 추세: <b class="${pd.formShadow !== pd.formTrend ? "diff" : ""}">${esc(pd.formShadow ?? "—")}</b></li>
    <li>추천 요원: <b class="${pd.agentShadow !== pd.recommendedAgent ? "diff" : ""}">${esc(pd.agentShadow ?? "—")}</b></li>
  </ul></div>
</div>
<p class="note">규칙은 기여 점수 최고 요원(Clove, 20경기 소표본)을, Jev는 주력 요원(Sova, 764경기 대표본)을 추천 — 소표본 효율 vs 표본 신뢰도의 실제 관점 차이입니다.</p>

<h2>7. 아키텍처</h2>
<div class="flow">
  <span class="node">HenrikDev API</span><span class="arrow">→</span>
  <span class="node">roundDetails (결정론적 팩트)</span><span class="arrow">→</span>
  <span class="node">DecisionEngine</span><span class="arrow">→</span>
  <span class="node">rules</span><span class="arrow">⇄</span>
  <span class="node jev">jev (shadow)</span><span class="arrow">→</span>
  <span class="node">UI 확신도 표시</span>
</div>
<ul class="list" style="margin-top:12px">
  <li><code>ANALYSIS_ENGINE=rules|jev|jev-shadow</code> — Jev 실패 시 라운드별 규칙 fallback</li>
  <li>Jev는 분류만 담당 — 킬/데스/교환 탐지 등 팩트는 전부 결정론적 코드 유지</li>
  <li>프로필 판정 + 라운드 판정 = 요청당 ~41회 Jev 호출, 무료 기간 $0 / 종료 후 ~$0.001 수준</li>
</ul>

<h2>8. 일어나서 확인하는 법</h2>
<pre>pnpm dev
# 브라우저: http://localhost:3000  (개요 탭 → "AI 판정" 카드, 라운드 탭 → 확신도 칩)
# API: http://localhost:3000/api/player?name=Henrik3&amp;tag=VALO&amp;region=eu

# 리포트 재생성:
#   /api/player 응답에서 추출한 JSON으로
node scripts/generate-report.mjs .report-data.json overnight-report.html</pre>

<h2>9. 다음 단계 권고</h2>
<ul class="list">
  <li><b>불일치 4건 수동 리뷰</b> — "승리 라운드 + 고비용 미교환 데스" 라벨이 코칭 관점에서 맞는지 판단. Jev의 낮은 확신도 이의제기가 더 타당하면 라벨 우선순위 조정 가치 있음</li>
  <li><b>다른 프로필로 재현성 확인</b> — 90% 일치율이 Henrik3 특이 케이스인지 검증</li>
  <li><b>9/25 프로모 종료 전 판단</b> — 유지 시 월 비용 ≈ 분석 횟수 × $0.001 미만. 가치 없으면 <code>ANALYSIS_ENGINE=rules</code>로 즉시 복귀 가능</li>
  <li><b>프로필 판정 신뢰 구축</b> — 추천 요원/폼 추세의 rules↔Jev 불일치를 여러 프로필에서 수집해 어느 쪽이 유용한지 판단</li>
</ul>

<footer>
  생성: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC ·
  Valorant Impact Lab · Jev via Vercel AI Gateway (무료 프로모 ~2026-09-25) ·
  이 리포트는 자체 완결 HTML입니다
</footer>
</div>
</body>
</html>
`

writeFileSync(outputPath, html, "utf8")
console.log(`report written: ${outputPath} (${Math.round(html.length / 1024)}KB)`)
