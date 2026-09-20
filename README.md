# Valorant Impact Lab

Valorant player performance dashboard built with Next.js and a temporary HenrikDev adapter.

## Current Scope

- Search by Riot ID, tag, and region.
- Fetch HenrikDev stored matches plus per-match detail (up to 8 competitive matches).
- Show stored competitive match summaries.
- Analyze contribution signals by agent, map, period, and recent matches.
- Round-level analysis: KAST, survival, trades, first bloods/deaths, clutch attempts, and economy.
- Optional AI decision layer (Jev / TypeSafe System One) that re-labels rounds with calibrated confidence.
- Keep API keys server-side only.

## Data Limits

This app currently uses HenrikDev `stored-matches`. That means the analysis is based on matches stored on HenrikDev's server, not Riot's complete historical match database.

Round-level stats (KAST, clutch, economy) come from `match` detail fetches for the most recent competitive matches only, so coverage is partial by design.

## Decision Engines

Round labeling is abstracted behind a `DecisionEngine` (`src/lib/valorant/decisions/`):

| `ANALYSIS_ENGINE` | Behavior |
| --- | --- |
| `rules` (default) | Deterministic heuristics with margin-based pseudo-confidence. No external calls. |
| `jev` | TypeSafe Jev answers are primary; rule labels are computed as a comparison baseline. Falls back to rules per round on API errors. |
| `jev-shadow` | Rules stay primary; Jev answers are attached for comparison. `agreementRate` in `decisionSummary` measures how often Jev agrees with the rules. |

Jev mode sends each scored round's state plus three questions (reason choice, contribution score, needs-review noul) to `POST {TYPESAFE_BASE_URL}/v1/systemone`. Answers carry calibrated confidence, which the UI renders as a confidence chip on each reviewed round.

`DECISION_MAX_ROUNDS` caps how many rounds are sent to the model (highest review priority first); `DECISION_CONCURRENCY` bounds parallel calls.

## Local Setup

Create `.env.local`:

```bash
VALORANT_DATA_PROVIDER=henrik
HENRIKDEV_API_KEY=your_henrik_key
HENRIKDEV_BASE_URL=https://api.henrikdev.xyz
```

Optional — enable the Jev decision layer:

```bash
ANALYSIS_ENGINE=jev-shadow
TYPESAFE_API_KEY=your_typesafe_key
TYPESAFE_MODEL=jev-latest
```

Run locally:

```bash
pnpm install
pnpm dev --hostname 127.0.0.1 --port 3000
```

## Temporary Deployment

Vercel is the simplest temporary deployment target for this Next.js app.

Set these environment variables in Vercel Project Settings:

```bash
VALORANT_DATA_PROVIDER=henrik
HENRIKDEV_API_KEY=your_henrik_key
HENRIKDEV_BASE_URL=https://api.henrikdev.xyz
```

Do not prefix `HENRIKDEV_API_KEY` or `TYPESAFE_API_KEY` with `NEXT_PUBLIC_`. Keys must stay server-side.

Then deploy:

```bash
pnpm dlx vercel
```

For a production URL:

```bash
pnpm dlx vercel --prod
```

## Quality Checks

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```
