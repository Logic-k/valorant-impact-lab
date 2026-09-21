---
name: local-dev-and-key-check
description: Start the valorant-impact-lab dev server locally, configure the HenrikDev / Typesafe keys, and verify the keys work with the test account GODRONALDO#CR7 (region ap). Use whenever you need the app running or need to confirm API credentials.
---

# Local dev server and API key check

This app has no user login. "Logging in" locally means providing server-side API keys
via environment variables (never `NEXT_PUBLIC_*`).

## 1. Environment variables

In Devin sessions the secrets are already exported in the shell:
`VALORANT_DATA_PROVIDER`, `HENRIKDEV_API_KEY`, `HENRIKDEV_BASE_URL`,
`ANALYSIS_ENGINE`, `TYPESAFE_API_KEY`, `TYPESAFE_BASE_URL`, `TYPESAFE_MODEL`.

Outside Devin, create `.env.local` from `.env.example` (see README "Local Setup").
Never write secret values into files that are committed.

Recommended override for local work:

```bash
export ANALYSIS_ENGINE=rules
```

`jev-shadow`/`jev` call the Typesafe API for every scored round. When Typesafe returns
429 (rate limit), the client retries with backoff and the page/API can take 1-4 minutes
to respond. `rules` needs no external AI call and responds in ~3s.

## 2. Start the dev server

```bash
cd ~/repos/valorant-impact-lab && source ~/.nvm/nvm.sh
export ANALYSIS_ENGINE=rules
pnpm dev --hostname 0.0.0.0 --port 3000
```

Run it in its own persistent shell (tty) so it stays alive. Ready when you see `✓ Ready`.
Do not `pkill -f "next dev"` from a shell that shares the process group with the server.

## 3. Verify the HenrikDev key directly (fast, no app needed)

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -H "Authorization: ${HENRIKDEV_API_KEY}" \
  "${HENRIKDEV_BASE_URL}/valorant/v1/account/GODRONALDO/CR7"
```

Expected: `HTTP 200` with `"name":"GODRONALDO","tag":"CR7","region":"ap"`.
`401`/`403` means the key is missing or invalid; `429` means HenrikDev rate limit — wait and retry.

## 4. Verify through the app

Test account: **GODRONALDO#CR7**, region **ap** (Asia Pacific). Regions accepted by the
app: see `parseRegion` in `src/app/api/player/route.ts`.

```bash
curl -s --max-time 170 \
  "http://localhost:3000/api/player?name=GODRONALDO&tag=CR7&region=ap" -o /tmp/p.json -w "HTTP %{http_code}\n"
python3 -c "import json; d=json.load(open('/tmp/p.json')); print(d['kind'], d['value']['displayName'], d['value']['region'], d['value']['summary']['matches'])"
```

Expected: `HTTP 200` and `ready GODRONALDO ap <n>`.

UI: open `http://localhost:3000`, fill the form (inputs with aria-labels
`Riot ID 이름`, `Riot ID 태그`, select `지역`) with `GODRONALDO` / `CR7` / `ap` and submit.

## Troubleshooting

- `node: command not found` → `source ~/.nvm/nvm.sh`.
- Root page `GET /` takes 60s+ → `ANALYSIS_ENGINE` is `jev-shadow` and Typesafe is rate-limiting; set `ANALYSIS_ENGINE=rules`.
- `[decisions] jev shadow call failed ... 429` in server log → Typesafe rate limit, not a HenrikDev key problem.
- Empty profile for a known player → wrong region (this account is `ap`, not `kr`).
