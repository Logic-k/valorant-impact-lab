# Valorant Impact Lab — 발로란트풀 대시보드 시각화 리포트

## 요약 (3줄)

- 현재 UI는 차트 라이브러리 0개의 표/텍스트 중심이지만, **이미 수집해서 버리고 있는 데이터(킬/데스 좌표, 플랜트/해제 좌표, 라운드 타임라인 ms)** 만으로 미니맵 히트맵·라운드 스트립 같은 발로란트풀 시각화가 추가 API 비용 없이 가능합니다.
- HenrikDev는 사용 중인 4개 엔드포인트 외에 **stored-mmr-history(경기별 RR/Elo), v4 match detail(스코어보드·어빌리티·데미지 이벤트·시야각)** 을 더 제공하고, **valorant-api.com(무키, 무료)이 에이전트/맵/무기/랭크 아이콘 에셋과 미니맵 좌표 변환 계수**를 제공합니다.
- Riot 공식 API는 개인/개발 키로는 매치 데이터 접근이 불가하고 프로덕션 키+RSO 동의 플로우가 필요해 사실상 대안이 아니며, HenrikDev는 basic 30req/min·stored 데이터 "구멍"이 구조적 한계입니다.

---

## 1. 현재 데이터 흐름도 (텍스트)

```
[사용자 검색: name/tag/region]
        │
        ▼
src/app/page.tsx  ── readConfig() ──▶ createValorantDataProvider()
        │                                 │ mock | henrik | riot(stub→항상 unavailable)
        ▼                                 ▼
HenrikDevProvider.getPlayerProfile()
        │
        ├─ GET /valorant/v2/account/{name}/{tag}          (이름/태그/레벨/지역)
        ├─ GET /valorant/v2/mmr/{region}/{name}/{tag}     (현재 티어/RR/직전 RR변동)  ← optional(404→null)
        ├─ GET /valorant/v1/stored-matches/{region}/...   (저장된 매치 요약 목록)
        └─ GET /valorant/v2/match/{id} ×최대 8개           (경쟁전만, concurrency=2)
                  kills[].위치 / rounds[].economy / plant/defuse 좌표 포함
        │
        ▼
toProfile()  →  buildPerformanceInsights() + buildRoundDetailInsights()
        │         (mapEvents 좌표까지 계산하지만 UI 미사용)
        ▼
withRoundDecisions()  →  rules | jev | jev-shadow 엔진으로 라운드 라벨링
        │
        ▼
<Dashboard> → <ProfileTabs> (개요/요원/맵/기간/라운드/경기 6탭, CSS radio 탭)
```

호출 비용: 프로필 1회 조회 ≈ 최대 11 API calls(account+mmr+stored+8 match detail). 메모리 캐시 60s, 타임아웃 6s, `maxDuration=300`.

---

## 2. 데이터 인벤토리

### 2.1 지금 가져오는 데이터 (HenrikDev v2 4종)

| 엔드포인트 | 용도 | 위치 |
|---|---|---|
| `v2/account` | 이름/태그/계정레벨/지역 | `henrik-provider.ts:93-102` |
| `v2/mmr` | 현재 티어, `ranking_in_tier`(RR), `mmr_change_to_last_game` | `henrik-provider.ts:104-122` |
| `v1/stored-matches` | 매치 요약(맵/모드/스코어/KDA/샷 분포/데미지/당시 티어) | `henrik-provider.ts:124-135` |
| `v2/match/{id}` | 라운드별 스탯/이코노미, 킬 이벤트+좌표, plant/defuse | `henrik-provider.ts:150-164`, 최대 8경기(`:36`) |

### 2.2 가져오지만 안 쓰는 데이터 — **추가 API 비용 0으로 시각화 가능**

| 데이터 | 현재 상태 | 시각화 후보 |
|---|---|---|
| `mapEvents` (kill/death/assist x,y 좌표) | `round-map-events.ts`에서 계산, `round-analysis.ts:46`에 넣지만 **렌더링하는 곳 없음** (`types.ts:184` 선언만) | 맵 미니맵 위 scatter/히트맵 |
| `rounds[].plant_events/defuse_events` 좌표 | 스키마는 파싱(`henrik-schemas.ts:142-151`)하지만 이벤트 변환 안 함 | 미니맵에 ◆플랜트/◎해제 마커 |
| `kill.player_locations_on_kill` (킬 순간 전원 위치) | 스키마 파싱됨(`henrik-schemas.ts:85-94`), 미사용 | 미니맵 "상황 재현" 모드 |
| 라운드 `timeline` (ms 단위 이벤트) | 텍스트 리스트로만 표시(`round-replay-list.tsx:83-101`) | 가로 시간축 킬피드 |
| `stats.shots` head/body/leg | 합산해 HS%만 사용(`henrik-transform.ts:117-120`) | 헤드/바디/레그 도넛·스택바 |
| `damage.received` | `postPlantImpact` 계산에만(`henrik-transform.ts:148-150`) | 준/받은 데미지 비교 바 |
| `stats.tier` (경기 시점 티어) | `rankAtMatch` 텍스트만(`henrik-transform.ts:155`) | 티어 변화 라인차트 |
| 매치별 economy `spent/remaining/loadout_value` | 평균만(`round-analysis.ts:40-41`) | 라운드별 이코노미 바차트 |

### 2.3 HenrikDev에서 추가로 얻을 수 있는 데이터 (미사용 엔드포인트)

| 엔드포인트 | 내용 | 대시보드 활용 |
|---|---|---|
| `v2/stored-mmr-history/{region}/pc/{name}/{tag}` | 경기별 `rr`, `last_change`, `elo`, `tier`, `was_derank_protected`, `refunded_rr` | **RR/랭크 추이 차트** — 현재 "과거 RR 없음" 제약(`matches-panel.tsx:21-24`)을 해소 |
| `v4/matches/{region}/pc/{name}/{tag}` | 요약이 아니라 **풀 매치 객체 목록**(10명 전원 스탯, `ability_casts`, `behavior.afk_rounds/friendly_fire`, `session_playtime`, `customization.card/title`, `party_rr_penaltys`, `season`) | 전체 스코어보드, 유틸 사용량, 플레이어 카드 배너, 시즌 필터 |
| `v4/match/{region}/{match_id}` | v2 대비 추가: 라운드별 `ability_casts`, `damage_events`(상대별 데미지), `was_afk`, `stayed_in_spawn`, plant `site`, 킬 `weapon`, `player_locations[].view_radians` | **상대별 듀얼 매트릭스**, 무기별 킬 분포, 시야 방향 화살표 미니맵 |
| `v1/content` | Act/시즌/맵/게임모드 목록 | 시즌(Act) 필터 UI, `seasonMode: "official_act"` 전환 기반 |
| `v1/leaderboard/{region}` (v1~v3) | Act별 리더보드 | 상위 %/순위 배지 |
| `v1/premier/*` | 프리미어 팀/로스터/히스토리 | 프리미어 유저면 팀 패널 |
| `v1/queue-status`, `v1/status`, `v1/game-version` | 서비스 상태 | providerWarning 대체 가능 |
| `v1/raw` | Riot 원본 페이로드 패스스루 | 디버깅/신규 필드 탐색 |
| `v1/crosshair/generate` | 크로스헤어 이미지 생성 | 재미 요소(프로필 카드 장식) |

### 2.4 Riot 공식 API — 알 수 있는 것과 한계

엔드포인트 자체: `ACCOUNT-V1`(by-riot-id/me), `VAL-MATCH-V1`(match/matchlists/recent-matches), `VAL-RANKED-V1`(act 리더보드), `VAL-CONTENT-V1`, `VAL-STATUS-V1`.

**한계가 치명적:**
- 개인/개발 키는 **VALORANT 매치 API 응답이 차단**됩니다. 프로덕션 키 심사(제품 피치 제출)가 필요.
- 모든 발로란트 앱은 **RSO(Riot Sign On) OAuth로 플레이어 데이터 공유 동의**를 받아야 하고, RSO 클라이언트도 프로덕션 키가 있어야 발급됩니다.
- 정책상 제3자가 임의 플레이어의 프로필/스카우팅 데이터를 동의 없이 노출하는 형태는 허용되지 않습니다 → 지금처럼 "아무 Riot ID나 조회"하는 구조는 공식 API로는 못 만듭니다.
- 결론: `RiotProvider`(`riot-provider.ts`)는 스텁 그대로 두는 게 맞고, 구조상 HenrikDev(또는 RSO+프로덕션 승인 후 개인 대시보드) 이원화만 현실적입니다.

### 2.5 valorant-api.com — 시각 에셋 (키 불필요, 무료, 클라이언트 직접 호출 가능)

- `/v1/agents` → `displayIcon`, `fullPortrait`, `background`, 어빌리티 아이콘
- `/v1/maps` → `displayIcon`(탑다운 미니맵), `splash`, `stylizedBackgroundImage`, `listViewIcon`, **`xMultiplier`, `yMultiplier`, `xScalarToAdd`, `yScalarToAdd`** ← 게임 좌표→이미지 픽셀 변환 계수
- `/v1/weapons` → `displayIcon` (무기별 킬 차트용)
- `/v1/playercards`, `/v1/playertitles` → v4 `customization.card/title` UUID와 매칭
- `/v1/competitivetiers` → 랭크 아이콘 이미지
- `?language=ko-KR` 로 한국어 이름 지원

미니맵 좌표 변환(커뮤니티 표준, 도입 전 한 번 검증 필요):
```
px = x * map.xMultiplier + map.xScalarToAdd
py = y * map.yMultiplier + map.yScalarToAdd   // 각각 0~1 정규화 → 이미지 크기 곱셈
```

---

## 3. 대시보드 시각화안 (데이터 → 위젯 매핑)

### 안 A — "Tracker.gg 스타일" 히어로 + 레이더 레이아웃
필요 데이터: 기존 + valorant-api 에셋 + `stored-mmr-history`. API 비용 +1 call.

```
┌────────────────────────────────────────────────────────────┐
│ ▓ 플레이어 카드 와이드 배너(v4 customization.card → playercard) │
│ [랭크아이콘] Henrik3 #VALO      Platinum 2 · RR 62 (▲12)     │
│ EU · Lv.312 · Act E10A5        최근: W W L W L (pill strip) │
├────────────────────────────────────────────────────────────┤
│ ACS 234 │ K/D 1.21 │ ADR 152 │ HS 28% │ 승률 54% │ KAST 71% │
│ ▁▃▅▂▇  각 카드 하단에 최근 10경기 스파크라인                    │
├──────────────────────┬─────────────────────────────────────┤
│  진짜 오각형 레이더     │  RR 추이 라인차트                      │
│      ╭────╮          │  80┤        ╭──                     │
│  전투╱      ╲진입     │  60┤   ╭──╮╱  ╲                    │
│ 통제│   ⬤    │유틸    │  40┤╭──╯  ╰    ╰──                │
│  생존╲      ╱         │    └─Act 경계선 표시 가능─▶          │
│      ╰────╯          │  (stored-mmr-history v2)           │
├──────────────────────┴─────────────────────────────────────┤
│ 요원 카드 스트립: [제트 초상+승률바][레이나][소바] …            │
└────────────────────────────────────────────────────────────┘
```
※ 현재 "Pentagon"은 사실 가로 바 5개(`profile-tabs.tsx:222-244`). 진짜 SVG 레이더로 교체하는 것만으로 발로란트 감성이 삽니다.

### 안 B — 맵 미니맵 이벤트 뷰어 (**신규 API 0건**, 이미 있는 데이터)
필요: `mapEvents`(기존) + valorant-api 맵 `displayIcon`+계수. plant/defuse는 스키마만 확장.

```
┌ 맵 이벤트 · Ascent ─────────────────────────────────────┐
│ ┌───────────────┐  범례: ●킬(적) ✕데스(백) ▲어시(청) ◆플랜트 │
│ │   ╭─────╮     │  필터: [킬][데스][어시][플랜트] 토글        │
│ │  ●  ╭──╮ ✕    │  라운드 슬라이더 ━━━●━━ R14               │
│ │ ╱A │사이트│╲  │  매치 선택 드롭다운                        │
│ │ │  ╰──╯ ●│    │                                            │
│ │  ╲  B  ╱      │  우측: 해당 라운드 타임라인 미니 리스트        │
│ │   ╰──╱        │                                            │
│ └───────────────┘                                            │
└────────────────────────────────────────────────────────────┘
```
발로란트 리플레이/분석 사이트의 시그니처 뷰. `view_radians`(v4)를 쓰면 방향 화살표까지 가능.

### 안 C — 경기 카드 강화 (기존 탭 재디자인)
```
┌ 경기 ─ Ascent · Competitive · E10A5 ────────────────────────┐
│ [맵 splash 썸네일 배경]    승리 13–9            RR +18 [chip] │
│ [제트 아이콘] 22/14/6 · ACS 287 · ADR 168 · HS 31%          │
│ 라운드 스트립(24셀): ■■■■■□■□■■■□■□ │ ■□■■■□■■■  승/패+색농도 │
│ 킬 무기 분포: Vandal ████████████ 12  Phantom █████ 5        │
│             Operator ███ 3                                   │
└─────────────────────────────────────────────────────────────┘
```
라운드 스트립은 `rounds[].winning_team` + 기여점수로 셀 색상(승=적색→채도, 패=무채색) — 발로란트 매치 리포트의 그것.

### 안 D — 라운드 히트맵 그리드 (라운드 탭 재편)
```
공격(1-12)  ■■■□■■□■□■□■        ■=승, 색농도=기여점수
수비(13-24) □■□■■■■□■□■■        테두리=첫킬/첫데스 마커
[셀 클릭] → 하단에 라운드 상세(무기/이코노미/타임라인/AI 판정)
```
지금 `<details>` 아코디언 나열(`round-replay-list.tsx`)을 셀 그리드로 바꾸면 한눈에 스캔됩니다.

### 안 E — 전체 스코어보드 + 듀얼 매트릭스 (v4 필요)
```
[아군 5 × 적군 5 스코어보드: ACS/K/D/A/FK/FD + 에이전트 아이콘]
듀얼 매트릭스: 나 ↔ 각 상대 damage_events 히트맵 (누가 나를 잡았나)
유틸 사용: ability_casts 막대 (궁/Q/E/수류탑 라운드당 사용량)
```

### 안 F — 이코노미/운 시각화
```
라운드별 spent vs loadout_value 스택바 + 승패 오버레이
"팀운" → 0~100 게이지 다이얼 + 최근 8경기 추이 스파크라인
저지를 구매/세이브 라운드 분포 히스토그램
```

### 안 G — 시즌/Act 컨텍스트
```
상단에 Act 선택 칩: [E10A4][E10A5]  ← stored-matches meta.season
헤더에 현재 Act 남은 일수 배지 (v1/content의 act endTime)
```

---

## 4. 시각화 라이브러리 후보 비교 (React 19 / Next 16 기준)

| 후보 | React 19 | 특징 | 이 프로젝트 적합도 |
|---|---|---|---|
| **순수 SVG/CSS** (의존성 0) | — | 레이더·미니맵 scatter·스트립은 수십 줄이면 됨. 현재 무차트·수제 CSS 스타일과 일치 | ★★★★★ 우선 추천 |
| Recharts **3.x** | ○ (peer `^19`, 2.x는 불가) | 라인/레이더/바 빠르게 구현 | RR 추이차트 도입 시 무난 |
| Apache ECharts (`echarts-for-react`) | ○ | 히트맵/커스텀 시리즈 최강, 번들 큼 | 미니맵 히트맵 고도화 시 |
| Nivo | △ (최신버전만 React 19) | 레이더/히트맵 깔끔 | 선택지 |
| Chart.js + react-chartjs-2 | ○ | 단순, 캔버스 기반 | 무난 |
| visx | ○ | D3 로우레벨, 자유도 최상 | 풀커스텀 원할 때 |
| Tremor | △ | Tailwind 의존 — 이 레포는 순수 CSS | 비추천 |

권장 조합: **미니맵·레이더·라운드스트립 = 순수 SVG**, **RR 추이 등 축 있는 차트 = Recharts 3** (또는 전부 순수 SVG로 통일해 무의존성 유지).

---

## 5. 발로란트 무드 디자인 토큰 (globals.css 치환 방향)

```css
:root {
  --v-red:    #FF4655;   /* Valorant signature red */
  --v-navy:   #0F1923;   /* 공식 다크 배경 */
  --v-white:  #ECE8E1;   /* 오프화이트 */
  --v-teal:   #38E8C6;   /* 보조 액센트 */
  --v-line:   #2A3A46;
}
/* 카드/패널: border-radius 제거 + clip-path 각진 모서리 */
.val-card {
  background: #111C26;
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px,
                     100% 100%, 12px 100%, 0 calc(100% - 12px));
}
```
- 폰트: 디스플레이는 Tungsten 대체로 **Teko/Oswald/Anton**, 본문은 **Rajdhani/Barlow Semi Condensed**, 한글은 **Pretendard** (overnight-report.html:14에서 이미 사용).
- 현재 `--accent:#ff5f57`(`globals.css:9`)가 이미 근접 — 배경을 `#101414`(녹조 다크)에서 `#0F1923`(네이비)로 바꾸면 체감이 큽니다.
- 탭은 발로란트 HUD처럼 대문자+각진 언더라인, 승패는 빨강/청록 대비(현재 win=teal은 유지 가능).

---

## 6. 관련 파일/라인 인용 요약

| 항목 | 위치 |
|---|---|
| 색상/폰트 토큰 | `src/app/globals.css:1-25` |
| "Pentagon" = 가로 바(레이더 아님) | `src/components/profile-tabs.tsx:222-244`, 스타일 `globals.css:925-955` |
| mapEvents 계산·미렌더링 | `src/lib/valorant/round-map-events.ts:4-17`, `round-analysis.ts:17,46`, `types.ts:184` |
| plant/defuse 좌표 파싱만 함 | `src/lib/valorant/providers/henrik-schemas.ts:142-151` |
| 킬 위치/전원 위치 파싱만 함 | `henrik-schemas.ts:85-97` |
| match detail 상한 8·동시성 2·TTL 60s | `src/lib/valorant/providers/henrik-provider.ts:36-38` |
| "과거 RR 없음" 노트 (mmr-history로 해소 가능) | `src/components/matches-panel.tsx:21-24` |
| `kast: 0` 하드코딩 → 펜타곤 "생존" 축 상시 0 | `henrik-transform.ts:90,143` + `analysis.ts:65` (실질적 버그) |
| Riot 프로바이더 스텁 | `src/lib/valorant/providers/riot-provider.ts:10-17` |
| 라운드 타임라인 텍스트 렌더 | `src/components/round-replay-list.tsx:83-101` |
| 서버 전용 키/엔진 설정 | `src/lib/config.ts:3-13` |
| 데이터 커버리지 고지 | `src/lib/valorant/performance.ts:21-28` |

---

## 7. 리스크 & 개선 제안

**리스크**
1. **HenrikDev rate limit**: basic 30 req/min, advanced 90 req/min. v4.0.0부터는 **API call + 백그라운드 Riot call 합산**이라 캐시 미스 시 비용이 배로 듭니다. 현재 프로필당 최대 ~11 call → 동시 조회 몇 명이면 429 위험. 대응: 캐시 TTL 연장(60s→수 분), `v3/v4/matches` 단일 호출로 통합 검토(캐시 히트 시 1 call), `X-RateLimit-*` 헤더 로깅.
2. **stored-matches 구멍**: Henrik 측 문서상 저장본은 Riot 전체 이력의 "부분 집합"이며 누락 허용. 커버리지 고지(`performance.ts:27`)는 유지하고, `results.total`로 "저장 N/전체 M" 표기를 더 명시하는 게 좋습니다.
3. **좌표 변환 검증**: 맵별 `xMultiplier/xScalarToAdd`는 valorant-api 제공값, Henrik 좌표와의 조합은 맵마다 한 번 시각 검증 필요(회전/반전 맵 존재).
4. **React 19 호환**: 차트 라이브러리 도입 시 Recharts는 반드시 3.x(2.x는 react-is 오버라이드 필요), 출시 7일+ 버전 고정.
5. **Riot ToS**: 공식 API 경로로 가면 RSO 동의 기반 본인 데이터만 가능. 현재의 임의 조회 UX는 HenrikDev 경로에서만 유지 가능 — 발로란트 스타일 에셋 사용은 Riot IP 가이드(팬 콘텐츠) 범위 내 표기 권장.
6. **`kast:0` 버그**: 펜타곤 "생존" 축이 항상 0(`analysis.ts:65`이 `match.kast` 참조). 라운드 기반 `kastRate`를 대신 쓰거나 digest 계산을 채워야 그래프가 의미를 가집니다.

**개선 제안 (우선순위 순)**
1. 미니맵 이벤트 뷰(안 B) — 추가 API 0건, 시각 임팩트 최대, 데이터 이미 존재
2. 진짜 레이더 오각형 + `kast` 계산 수정 — 가장 "발로란트스러운" 체인지
3. `stored-mmr-history` 연동 RR 추이 차트 — 기존 UI의 명시된 공백을 메움
4. 경기 카드에 맵 splash/에이전트 아이콘 + 라운드 스트립(안 C/D)
5. 디자인 토큰 교체(navy/red, clip-path, Teko+Pretendard)
6. (선택) `v4/match` 전환 → 스코어보드·듀얼 매트릭스·무기 분포
7. (선택) `v1/content`로 Act 필터, `seasonMode:"official_act"` 활성화
