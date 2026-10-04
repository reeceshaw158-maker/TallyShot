# TallyShot — Architecture Decisions

> Filled in from the shipped code during the 2026-09-19 audit. These are not
> proposals — they are what Slices 11 and 12 actually built and what is running
> today. Source of truth: `src/services/productLookup.ts`, `src/db/`,
> `worker/wrangler.toml`.

## Barcode Data Source Waterfall
Implemented in `src/services/productLookup.ts`. Steps 0–2 run automatically on
every scan and cost nothing. Step 3 is behind an explicit button because it is
the only step that can be confidently *wrong* rather than simply absent.

0. **Local SQLite cache** — `barcode_cache` table. Instant, offline, free.
   Misses cached for 6 hours.
1. **Open Food Facts family (v3 API)** — Open Food Facts, Open Beauty Facts,
   Open Products Facts, Open Pet Food Facts. Keyless. Called direct from the
   device so rate limits land per user, not per app.
2. **UPCitemdb free tier** — 500M+ general products. Keyless, 100/day per IP.
   Exact-GTIN guard rejects any non-matching item.
3. **AI guess via the Cloudflare Worker** (`lookup` mode) — user-triggered,
   chip-labelled "AI guess", the only step that burns a scan credit.
4. **Manual entry** — always available. A scan can never dead-end.

**Why v3 and not v2:** v3 normalises GTINs server-side, so `049000006346` and
`0049000006346` return the same product. v2 required sending both forms to all
four databases — up to 8 requests per scan against a 15 req/min/IP ceiling that
OFF will IP-ban over. v3 brings the worst case to 5. A `RateBudget` class caps
OFF at 12/min and their search endpoint at 6/min for headroom.

**Gotcha:** v3 reports a normalised barcode as `status: "success_with_warnings"`,
not `"success"`. `result.id` is the only safe found/not-found check.

**Barcode normalisation:** UPC-E expanded to UPC-A; UPC-A tried as 12- and
13-digit forms; GTIN-14 stripped to EAN-13; non-retail symbologies (QR,
Code 128…) skip the database chain entirely.

## Local Cache Strategy
Library chosen: **expo-sqlite** (already a dependency; Expo Go compatible).
Reason: the app already stores receipts in SQLite, so one engine covers both.
MMKV was never needed — `react-native-mmkv` is a native module and would end
Expo Go compatibility.
Cache key structure: canonical GTIN (post-normalisation) → serialised
`ProductCard`.
TTL strategy: hits kept indefinitely (cleared by Settings → Delete all data);
**misses** expire after 6 hours — long enough that a rescan does not burn the
rate budget, short enough that a product added to OFF today is findable
tomorrow.
Zustand + AsyncStorage holds app preferences; SQLite holds all records.

## Barcode Scanning Library
Library: **expo-camera** (`CameraView`, `onBarcodeScanned`, `scanFromURLAsync`)
Version: `~55.0.18`
Reason chosen: ML Kit under the hood on Android, zero native config, works in
Expo Go. `react-native-vision-camera` is in package.json but **imported
nowhere** — see BUG-010; it does not work in Expo Go and should be removed.
Formats supported: EAN-13, EAN-8, UPC-A, UPC-E, QR, Data Matrix, Code 39/93/128,
ITF-14, Codabar, PDF417, Aztec.

**Two expo-camera constraints the design works around:**
- The Android analyzer calls `barcodes.first()` and discards the rest of the
  frame, so the live callback structurally cannot report multiple codes.
  The confirm-before-scan picker therefore runs on a captured still, where
  `scanFromURLAsync` returns all of them.
- `autofocus` is iOS-only, so on Android there is no way to ask whether focus
  has settled. Proxy used: a code must decode identically on **3 consecutive
  frames** (`STABLE_READS`) before the app acts.
- `type` comes back as a string from the live callback but a serialised numeric
  constant from `scanFromURLAsync` on Android, despite both being typed
  `string`. Normalised in `normaliseBarcodeType()`.

## AI Integration
All AI runs through a Cloudflare Worker (`tallyshot-proxy`) so the Anthropic key
never ships in the app bundle. Models are Worker vars, changeable without a
client release (`worker/wrangler.toml`):

| Mode | Model | Why |
|---|---|---|
| `extract` (receipts) | `claude-opus-5` | needs `output_config.effort` |
| `detect` (viewfinder box) | `claude-haiku-4-5` | runs on a timer, must be cheap |
| `lookup` (AI barcode guess) | `claude-opus-5` | last-resort accuracy |
| `ingredients` (INCI photo) | `claude-opus-5` | a misread allergen is the worst error the app can make |

Client timeout: 8s via `AbortController`. **No retry/backoff yet — see BUG-008.**

> NOTE: the original brief named `claude-sonnet-4-6` as the model. That model
> ID does not exist. The IDs above are what is actually deployed and are real.

The `ingredients` mode exists because Open Beauty Facts has names and photos for
most cosmetics but almost no INCI lists — of four real Nivea/L'Oréal products
sampled, none had one. Its prompt is transcription-only and explicitly forbidden
from judging ingredients, so the card reads identically whether the list came
from a database or the user's camera.

## Category System
Implemented as `ProductKind` in `productLookup.ts`, derived from the source
database plus category tags. Decides the card layout.

- `food`
- `drink`
- `alcohol`
- `cosmetic`
- `petfood`
- `other`

**Classifier trap already hit and fixed:** OFF tags Coca-Cola
`en:non-alcoholic-beverages`, which *contains* the substring
"alcoholic-beverage". A naive match offered UK unit counts for a can of Coke.
Alcohol-free beer and de-alcoholised wine hit the same trap.

Receipt/expense categories are a separate, unrelated list in `src/constants.ts`
(`CATEGORY_ICONS`): Food & Drink, Travel, Transport, Accommodation, Office &
Tech, Utilities, Healthcare, Entertainment, Shopping, Other.

## Theme
`src/theme/index.ts` is the single source of truth: `darkTokens` / `lightTokens`
consumed via `useThemeTokens()`. Shipped palette is **Indigo `#818cf8` + Amber
`#f59e0b`**, supporting both dark and light.

> CONFLICT, UNRESOLVED: PROJECT.md specifies `#00C896` teal, dark-mode-first and
> "NEVER orange". `#00C896` appears nowhere in the app and amber is the CTA on
> every screen. Needs a decision before any Phase 4 design work — see the
> 2026-09-19 session entry.
