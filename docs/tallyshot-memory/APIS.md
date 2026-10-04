# TallyShot — API Reference

## Cloudflare Worker (the AI proxy)
Every AI call goes through this so the Anthropic key never ships in the bundle.

- Name: `tallyshot-proxy`
- URL: `https://tallyshot-proxy.tallyshot.workers.dev`
- Source: `worker/src/index.ts`, config `worker/wrangler.toml`
- Client env var: `EXPO_PUBLIC_WORKER_URL`
- Modes: `extract` (receipts) · `detect` (viewfinder box) · `lookup` (AI barcode
  guess) · `ingredients` (INCI transcription from a photo)
- Timeout: 8 seconds (`AbortController`)
- Retry: **none yet** — BUG-008. Engineering rules require exponential backoff x2.

> ⚠️ **BUG-001.** The URL above is set only in `eas.json` build profiles, which
> do not apply to `expo start`. With no `.env` on disk the client falls back to
> `https://your-worker.your-subdomain.workers.dev` and every AI feature fails in
> Expo Go. Fix: create `.env` in the project root containing
> `EXPO_PUBLIC_WORKER_URL=https://tallyshot-proxy.tallyshot.workers.dev`
> (`.env` is gitignored, so this is per-machine).

## Claude AI (behind the Worker)
Models are Worker vars — changeable by redeploying the Worker, no client release.

| Mode | Model | Note |
|---|---|---|
| `extract` | `claude-opus-5` | needs `output_config.effort`; older tiers 400 on it |
| `detect` | `claude-haiku-4-5` | polls on a timer, must stay cheap |
| `lookup` | `claude-opus-5` | last-resort identification |
| `ingredients` | `claude-opus-5` | a misread allergen is the worst error the app can make |

- Key: set via `wrangler secret put ANTHROPIC_API_KEY` — never in the repo.
- ⚠️ **BUG-002:** the key currently has no credit. `"Your credit balance is too
  low to access the Anthropic API."` Every AI feature is down until topped up.

> The original brief named `claude-sonnet-4-6`. No such model exists — the real
> current families are Claude 5 (`claude-opus-5`, `claude-sonnet-5`,
> `claude-fable-5-1`) and `claude-haiku-4-5`. PROJECT.md still carries the brief's
> wording; this table is the deployed truth.

## Open Food Facts (and family)
- Base URLs:
  - `https://world.openfoodfacts.org`
  - `https://world.openbeautyfacts.org`
  - `https://world.openproductsfacts.org`
  - `https://world.openpetfoodfacts.org`
- Auth: none required (free, open)
- Endpoint: **v3** — `/api/v3/product/{barcode}.json`
- Rate limit: 15 product reads/min/IP, and they will IP-ban over it. Client caps
  itself at 12/min (`RateBudget`); their search endpoint is capped at 6/min.
- User-Agent (required by their terms): `TallyShot/1.1 (hello@tallyshot.app)` —
  deliberately a project address, since this header reaches third-party servers
  on every lookup from every user's device.
- Licence: ODbL. Attribution line must be visible wherever the data is shown.
- Gotcha: a normalised GTIN returns `status: "success_with_warnings"`, not
  `"success"`. Check `result.id` for found/not-found.

## UPCitemdb (free tier)
- Base URL: `https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}`
- Auth: none (trial tier)
- Rate limit: 100/day per IP — called from the device, so it is per user
- Covers: 500M+ general products (electronics, tools, toys)
- Guard: exact-GTIN match required; junk entries are rejected

## RevenueCat
- Env var: `EXPO_PUBLIC_REVENUECAT_KEY`
- Entitlement checked: `pro`
- Native module — unavailable in Expo Go. `src/services/purchases.ts` lazy-requires
  it and returns safe defaults, so the app boots fine in Go with purchases off.
- ⚠️ **BUG-006:** `purchasePackage()` is the one function missing the null guard.
