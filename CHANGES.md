# TallyShot changelog

## Unreleased — Slice 12: Best-in-class product scanner

Slice 11 made the scanner find products. This slice makes it *tell you about
them* — ingredients, nutrition, allergens, alcohol units — and fixes the two
failure modes that dominate 1–2★ reviews of competing barcode scanners.

### Scanning behaviour

**Confirm before scanning (new default).** On a stable read the preview
freezes on a captured still, every barcode in that still is highlighted, and
you tap the one you meant. The complaint this answers: scanners that act on
the first code they decode, before you have finished aiming. On a parcel
carrying a courier label, a returns label and a product barcode, "first one
seen" is reliably the wrong one. Settings → Barcode scanner → **Instant scan**
turns the old behaviour back on.

This had to be built on a captured still rather than the live callback.
expo-camera's Android analyzer calls `barcodes.first()` and discards the rest
of the frame's results before they ever reach JavaScript, so the live callback
structurally cannot report that there are three codes in shot.
`scanFromURLAsync` on the still returns all of them.

**Blur defence.** expo-camera's `autofocus` prop is iOS-only, so on Android
there is no way to ask whether focus has settled. Instead a code must decode
*identically on 3 consecutive frames* before we act — a decent proxy for
"focus has stopped moving" — and the still we then freeze on is taken through
the full camera pipeline, so it is sharper than a live analysis frame anyway.

**All retail formats stay enabled**: EAN-13, EAN-8, UPC-A, UPC-E, QR,
Data Matrix, Code 39/93/128, ITF-14, Codabar, PDF417, Aztec.

### Product cards, by category

- **Food & drink** — photo, Nutri-Score, NOVA, kcal, and UK FSA traffic
  lights per 100g/100ml, plus ingredients, declared allergens and additives.
- **Alcohol** — ABV and UK units per container and per multipack. Factual
  content only; no health framing either way.
- **Cosmetics** — the INCI list where a database has one, and where it does
  not, a "photograph the ingredients" button that transcribes it.
- **Everything else** — name, brand, category, photo.

Every card carries one neutral guidance line ("High in fat, saturates and
sugars", "Contains 2 things you flagged: dairy and tree nuts"), a permanent
**"Not medical or dietary advice"** footer, and ODbL attribution where the
data came from the Open Food Facts family.

### Your own flags

Settings → **Highlight on scan**: the 14 UK/EU declarable allergens plus six
cosmetic concerns (fragrance, parabens, sulphates, denatured alcohol,
silicones, formaldehyde releasers). Matches are shown with how firm they are —
declared on the label, "may contain", or found by reading the ingredient text.

### Alternatives

Products graded Nutri-Score D or E get a **"Show better-scoring products"**
button, listing Nutri-Score A products from the same Open Food Facts category.
Button-triggered, never automatic — see the rate-limit note below.

### Scan history

New screen (Settings → Barcode scanner → Scan history): search by name, brand
or barcode digits, filter by category, swipe to delete with a 5-second undo.
Tapping a row reopens the product, answered instantly and offline from cache.

### Under the hood

**Moved to the Open Food Facts v3 API — for rate-limit reasons, not novelty.**
OFF publishes a ceiling of 15 product reads/min/IP and reserves the right to
IP-ban over it. The v2 code sent two barcode forms (12-digit UPC-A and 13-digit
EAN) to each of four databases, so one scan could cost 8 requests and two scans
in a minute put a user at the edge of a ban. v3 normalises GTINs server-side —
verified live, `049000006346` and `0049000006346` return the identical product
— so one canonical candidate now goes to each source. Worst case is 5 requests,
and a sliding-window budget stops at 12/min for headroom, degrading to
"couldn't check everything" rather than a false "not in any database".

Misses are cached for 6 hours: long enough that a re-scan doesn't burn the
budget, short enough that a product added today is findable tomorrow.

Note for future work: v3 reports a normalised barcode as
`status: "success_with_warnings"`, not `"success"`, so `result.id` is the only
safe found/not-found check.

**New Worker mode `ingredients`** transcribes an ingredient list from a photo
of a pack. This exists because Open Beauty Facts has names and photos for most
cosmetics but almost no INCI lists — of four real Nivea/L'Oréal products
sampled, none had one. The prompt is transcription-only and explicitly
forbidden from judging ingredients, so the wording on the card is identical
whether the list came from a database or your camera.

### Bugs found and fixed while building this

- **"Sans gluten" read as "contains gluten".** Nutella's ingredient text ends
  with the French for *gluten-free*, and a naive substring search told a
  coeliac user the jar contained it. Flag matching now rejects a hit when a
  negator sits either side, in English, French, Spanish, German, Italian,
  Dutch and Swedish.
- **Coca-Cola classified as alcohol.** OFF tags it
  `en:non-alcoholic-beverages`, which contains the substring
  "alcoholic-beverage". The card was offering UK unit counts for a can of
  Coke. Alcohol-free beer and de-alcoholised wine hit the same trap.
- **expo-camera returns two different types for `type`.** The live callback
  maps ML Kit's numeric format to `"ean13"`; `scanFromURLAsync` on Android
  serialises the raw constant and returns `32` — despite both being typed
  `string`. A UPC-E picked off the frozen frame would have arrived as
  `"1024"`, failed every `type.includes('upc_e')` check and silently skipped
  expansion. Normalised in one place now.
- **Nutri-Score showed "unknown" as a grade.** Only a–e is real.
- **Products displayed as "Nutella" by "Nutella"** — an identical brand and
  name is now shown once.
- **A paywall banner on a free feature.** The red "monthly limit reached, tap
  to unlock" bar rendered in barcode mode too. Barcode scanning costs nothing
  and never has; the banner is now receipt-mode only.
- Frozen stills are deleted on every exit path instead of accumulating.

### Not medical advice

Every string the nutrition engine produces restates the label and never
diagnoses the person. "High in sugar" is a fact about the jar. There is no
wording anywhere that predicts a health outcome or tells the user what to eat.

### Files

- `src/services/nutrition.ts` (new) — FSA thresholds, NOVA, alcohol units,
  flag matching, guidance lines. Pure functions, no network, no state.
- `src/services/productLookup.ts` — v3 rewrite, `ProductCard`, rate budget,
  category classifier, alternatives search.
- `src/components/ProductCard.tsx` (new), `src/components/BarcodePicker.tsx` (new)
- `src/db/scanHistory.ts` (new), `src/db/barcodeCache.ts`, `src/db/schema.ts`
- `app/scan-history.tsx` (new), `app/capture.tsx`, `app/(tabs)/settings.tsx`,
  `app/_layout.tsx`, `src/stores/appStore.ts`, `src/services/detection.ts`
- `worker/src/index.ts`, `worker/wrangler.toml`

### New dependency

`expo-clipboard` — for the copy action on the decoded barcode value.

### Verification

- `npx tsc --noEmit` → 0 errors
- `npx expo export --platform android` → clean bundle
- 51 assertions over the FSA boundary values, the NHS alcohol-unit worked
  example (5.2% × 568ml = 2.95 units), the negation cases and real Open Food
  Facts payloads
- Live chain tested against real barcodes: Nutella (Nutri-Score E, NOVA 4,
  3 allergens), Coca-Cola (kind=drink), a US 12-digit UPC-A (proves v3
  normalisation), 1664 / Corona / Grimbergen (kind=alcohol, 1.38 / 1.49 /
  1.68 units), and a nonexistent code (clean miss path)

### ⚠️ Known blocker, not caused by this slice

The Anthropic API key behind the Worker has **no credit**:
`"Your credit balance is too low to access the Anthropic API."` Every AI
feature is down until it is topped up — receipt extraction, AI camera assist,
the AI barcode guess and the new ingredients reader. The untouched `lookup`
mode fails identically, so this predates this slice.

The free database chain — which is the bulk of the scanner — does not use the
Worker at all and works normally.

---

## Unreleased — Slice 11: Worldwide barcode lookup chain

The barcode scanner no longer relies on AI guessing alone. Scans now run a
free database chain automatically, with AI demoted to an explicit last-resort
button. A scan can never dead-end.

### Lookup chain (new `src/services/productLookup.ts`)
1. **Local cache** — new `barcode_cache` SQLite table. Rescans are instant
   and work offline. Cleared by Settings → Delete all data.
2. **Open Food Facts family** — Open Food Facts, Open Beauty Facts,
   Open Products Facts, Open Pet Food Facts. Free, no key; called directly
   from the device so rate limits apply per user, not per app. Custom
   User-Agent sent as their terms request; ODbL attribution line shown on
   results ("Product data from Open Food Facts").
3. **UPCitemdb free tier** — 500M+ general products (electronics, tools,
   toys). Keyless; per-IP limit (100/day) becomes per-user because calls
   come from the phone. Exact-GTIN guard rejects any non-matching item.
4. **AI guess (existing Worker `lookup` mode)** — now user-triggered via
   "Ask AI for a guess" and clearly chip-labelled "AI guess". Still the only
   step that costs an AI scan.
5. **Manual entry** — "Type details myself" opens the Review screen with the
   barcode pre-filled as the reference number, so the code is saved even
   when nothing identified it.

### Barcode normalisation
- UPC-E expanded to UPC-A (standard NS+6+check algorithm, verified against
  published examples).
- UPC-A tried as both 12-digit and 13-digit (leading zero) forms — the
  databases index the EAN-13 form.
- GTIN-14 (ITF-14 cartons) stripped to EAN-13.
- Non-retail symbologies (QR, Code 128, …) skip the database chain and go
  straight to AI/manual, saving pointless network calls.

### Capture screen changes
- Database lookup fires automatically on scan (free, so no button and no
  scan-limit gate). Card shows a live "Checking free product databases…"
  state, then either the match (with source chip: which database, or
  "saved on this phone" for cache hits) or a "Not in any database yet"
  card offering AI guess + manual entry.
- Confidence % now only shown for AI guesses — database matches are exact.
- Estimated price only ever comes from the AI path; database results leave
  price at 0 for the user to fill in (foreign price guesses were misleading).

### Onboarding + marketing (dual-scanner story)
- Onboarding welcome: body copy and feature grid now lead with both scanners
  ("Snap a receipt — or scan a product barcode"); grid grew to 6 features
  including "Product barcodes worldwide" and "Rescans work offline".
- Onboarding free tier: "Unlimited barcode lookups" added (true — the DB
  chain never touches the AI scan limit).
- Onboarding permissions copy mentions barcodes.
- `docs/play-store-listing.md`: "Two scanners in one" differentiator bullet,
  barcode lines in WHAT YOU CAN DO / PRIVACY / PERMISSIONS / What's new.
- `docs/privacy-policy.md` + `docs/privacy-policy.html`: new disclosure that
  barcode scans send only the barcode digits to Open Food Facts family +
  UPCitemdb; scanned-product cache added to local-data and retention lists.
- `docs/play-data-safety.md`: note that barcode digits are not personal data,
  so no Data Safety form answers change.

### Verification
- `npx tsc --noEmit` → 0 errors
- Live API shapes verified with real barcodes (OFF hit + miss, UPCitemdb
  hit + junk-entry guard).

---

## Unreleased — Slice 10: Smoothness pass

### S1 — Cold start white flash eliminated
`_layout.tsx` returned `null` while Inter fonts loaded, causing a 1-frame
white (or black in dark mode) flash before anything appeared. Now returns a
`View` with the correct theme background colour so the transition is invisible.

### S2 — Receipts list loading spinner
The list flashed empty then filled in on every app open. Added `initialLoading`
state: an `ActivityIndicator` shows until the first SQLite query resolves, then
the list (or empty state) appears cleanly in one step.

### S3 — Stats loading spinner
Stats screen showed blank charts for a frame before data arrived. Now shows
a full-screen `ActivityIndicator` until the DB query resolves. Resets whenever
the user switches between This Month / Last Month.

### S4 — 30-second timeout on OCR processing
If the Cloudflare Worker never responded (network drop, worker cold-start hang)
the spinner ran forever with no exit. After 30 seconds the screen now
transitions to the error state so the user can retry or save manually.

---

## Unreleased — Slice 9: Bug hunt & fix pass

10 bugs found and fixed across all screens. No new features — pure stability.

### B1 — Empty state never showed on first launch (BLOCKER)
`FlatList data` was always `[null, ...receipts]` so `ListEmptyComponent` never
triggered (array was never empty). Moved search bar + filter chips to
`ListHeaderComponent` so data can actually be empty and new users see the
"No receipts yet" screen with the Scan button.

### M1 — Month total used UTC date, not device local time
`toISOString()` returns UTC — receipts near midnight could land in the wrong
month for users in UTC+ timezones. Fixed: use `toLocaleDateString('en-CA')`
which returns `YYYY-MM-DD` in the device's local timezone. Applied to both
`index.tsx` (header total) and `stats.tsx` (period queries).

### M2 — Malformed AI response showed cryptic technical error
`JSON.parse` and `ExtractionSchema.parse` threw raw JS errors if the worker
returned unexpected content. Wrapped in try/catch with plain-English messages
("AI returned an unexpected response. Please try again.") that actually appear
in the processing error card.

### M3 — Camera bottom bar cut off on some Android phones
`paddingBottom: 52` hardcoded in the camera screen's bottom bar could put the
shutter button in the gesture zone on Samsung and other gesture-nav phones.
Fixed with `useSafeAreaInsets` — `Math.max(48, 20 + insets.bottom)`.

### M4 — Scan count incremented before receipt saved (Quick Scan)
`incrementScanCount()` ran before `saveConfident()`. If the DB write failed, a
free scan was burned with nothing saved. Moved the increment to after a
successful save in the quick-scan path.

### N1 — Currency format hardcoded to en-GB locale
`Intl.NumberFormat('en-GB', ...)` gave correct results for UK users but wrong
decimal/thousands separators for European and other locales. Changed to
`undefined` locale so the device's own locale is used automatically.
Applied to `index.tsx`, `stats.tsx`, and `receipt/[id].tsx`.

### N2 — CATEGORY_ICONS duplicated across 3 files
The icon lookup object was copy-pasted into `index.tsx`, `stats.tsx`, and
`receipt/[id].tsx` and had already diverged (stats was missing `Shopping`).
Extracted to `src/constants.ts` as single source of truth.

### N3 — resetScanCountIfNewMonth called on every Settings visit
Side effect was in a `useEffect` in `settings.tsx`, running every time the
user opened that screen. Moved to `_layout.tsx` so it runs once at app startup.

### N4 — No haptic feedback on destructive actions
Added `expo-haptics`:
- Long-press to select → `ImpactFeedbackStyle.Medium`
- Bulk delete → `ImpactFeedbackStyle.Medium`
- Trash icon (receipt detail) → `ImpactFeedbackStyle.Medium`
- Undo → `NotificationFeedbackType.Success`

### N5 — Long-press delay inconsistent (350ms list, 450ms detail)
Unified `delayLongPress` to 350ms in `receipt/[id].tsx` DetailRow.

---

## Unreleased — Slice 8: Tab bar safe area + Delete receipt

### Bug 1 — Tab bar safe area (Samsung / edge-to-edge)
`edgeToEdgeEnabled: true` in app.json means the system navigation bar
(Samsung gesture strip or button row) lives inside the app's drawing area.
The tab bar had hardcoded `height: 64` and `paddingBottom: 8`, so it sat
*behind* the system nav on affected devices — tapping a tab triggered the
system back/home gesture instead.

Fix: `useSafeAreaInsets()` in `app/(tabs)/_layout.tsx`. Tab bar height
becomes `64 + insets.bottom`; paddingBottom becomes `8 + insets.bottom`.
On devices without a visible nav bar `insets.bottom` is 0, so the layout
is unchanged on those devices.

### Bug 2 — Delete receipt (with 5-second undo)

**Receipt detail — trash icon header button**
- Trash icon (`delete-outline`) added to the top-right of the native header
  via `<Stack.Screen options={{ headerRight: ... }} />`
- Tapping it shows: "Delete receipt? / This cannot be undone." → Cancel / Delete
- On confirm: `archiveReceipt(id)` (immediate disappearance) +
  `setPendingDeletion({ ids, label })` in the store → `router.replace('/(tabs)')`
- The existing Archive button at the bottom is unchanged (soft-delete,
  recoverable from Settings → Archived Receipts); the new button is hard-delete
  with a 5-second undo window

**Receipts list — undo snackbar**
- Watches `pendingDeletion` from store via `useEffect`
- Paper `Snackbar` appears with `duration={5000}` and "Undo" action button
- On Undo: `restoreReceipt` for each id, clear store, reload list
- On dismiss (timer expires): `permanentlyDeleteReceipt` for each id, clear store, reload list
- Snackbar sits above the tab bar via `style={{ marginBottom: insets.bottom }}`
- `TODO v1.1` comment marks where cloud-sync deletion would go

**Receipts list — multi-select delete**
- Long-press (350 ms) on any card → enters select mode; that card is immediately selected
- In select mode, the normal header is replaced with: close icon + "N selected" count + red Delete button
- Each card shows a filled/empty circle checkbox indicator
- Tapping any card in select mode toggles its selection; single tap no longer navigates
- Delete button archives all selected receipts and fires the same pending-deletion / undo flow

**Store changes**
- `PendingDeletion` type and `pendingDeletion` state added to `appStore`
- Excluded from AsyncStorage persistence via `partialize` — if the app
  restarts mid-window the receipt stays archived (recoverable) rather than
  being silently lost or unexpectedly restored

### Files touched
- `app/(tabs)/_layout.tsx` — safe area insets in tab bar
- `app/(tabs)/index.tsx` — undo snackbar + multi-select
- `app/receipt/[id].tsx` — trash header button, `handleHardDelete`, `handleArchive` rename
- `src/stores/appStore.ts` — `PendingDeletion` type, `pendingDeletion` state, `partialize`
- `CHANGES.md` — this entry

### Verification
- `npx tsc --noEmit` → 0 errors

---

## Unreleased — Slice 7: CP2 triage + Expo Go fix

### CP2 triage result
All six V1 blockers from the competitive-research session 6 plan are **already
built**. No new code needed for CP3 — the codebase is V1-complete on blockers.

| Blocker | Status | Where |
|---|---|---|
| 1 — One-tap sub cancellation (Play deep link) | ✅ done | `settings.tsx` SUBSCRIPTION section + `src/services/subscription.ts` |
| 2 — Visible sync status + retry | ✅ done | `ReceiptStatusPill`, home banner, receipt detail retry button |
| 3 — Photo mode toggle (default unfiltered) | ✅ done | `settings.tsx` CAPTURE section, `appStore.photoMode: 'original'` |
| 4 — Every field editable (incl. invoice number) | ✅ done | `review/[id].tsx` — all fields; long-press flags wrong extractions |
| 5 — Net / VAT / Gross display mode | ✅ done | `settings.tsx` DISPLAY section + `receipt/[id].tsx` summary grid |
| 6 — Archived view + restore button | ✅ done | `app/archived.tsx`, registered in `_layout.tsx` |

V1.1 candidates (not yet built, correctly deferred): mileage tracking,
accountant invite.

V2 candidates (correctly deferred): QuickBooks/Xero/Sage integrations,
vendor-invoice extraction.

### Expo Go fix
- Removed deprecated `newArchEnabled: true` from `app.json`. In SDK 55 the New
  Architecture is mandatory; this key no longer does anything and generates a
  build warning.
- The Expo Go version on the Play Store is still at SDK 54. To preview the app
  you must install Expo Go for SDK 55 directly from Expo (see instructions
  below — one URL, one QR code, done).

### Files touched
- `app.json` — remove `newArchEnabled`
- `CHANGES.md` — this entry
- `docs/competitive-research.md` — session 6 verification section added

### Verification
- `npx tsc --noEmit` → 0 errors

---

## Unreleased — Slice 6: Trust-building v1 blockers (post-research session 5)

Following competitive research on SparkReceipt + Dext (see
`docs/competitive-research.md` sections E–H). Each blocker counters a
specific 1–3★ review pattern from a competitor.

### Blocker 1 — Honest one-tap subscription cancellation
- New `src/services/subscription.ts` — `getManageSubscriptionUrl(sku?)` and
  `openManageSubscription(sku?)`. Deep-link format verified against
  Google Play's developer docs (May 2026):
  `https://play.google.com/store/account/subscriptions?package=<pkg>[&sku=<sku>]`
- New "SUBSCRIPTION" section in Settings with a single "Cancel subscription"
  row that opens Play's subscription manager directly. No retention modal,
  no guilt screen, no hidden close button.
- Visible to all users, not just paid — when there's no active subscription,
  Play's page handles that gracefully. We'd rather pre-bake the pattern
  than retrofit it after launch.
- Counters SparkReceipt's most-cited cancellation complaint: "downgrade →
  billing → only cancels next bill" (Joseph Wong, Jan 2026).

### Files touched
- `src/services/subscription.ts` (new)
- `app/(tabs)/settings.tsx` — new section, new import
- `CHANGES.md` — this entry

### Verification
- `npx tsc --noEmit` → 0 errors

---

## Unreleased — Slice 5: Play Store release readiness (Checkpoint 4)

No app code shipped. All work is configuration and documentation needed
to publish to Google Play.

### app.json
- **Permissions cleanup**: removed `READ_EXTERNAL_STORAGE` and
  `WRITE_EXTERNAL_STORAGE` (not needed — `expo-camera` writes to app private
  storage, `expo-image-picker` uses the system photo picker which doesn't
  need full storage access on Android 13+)
- Added `INTERNET` explicitly (required for Worker calls)
- Added `blockedPermissions` for everything we *don't* need but might be
  pulled in transitively: location, microphone, audio recording, full media
  library access. This makes the Play Console permissions list match what
  the app actually does — fewer "why do you need this?" questions.
- Tightened permission rationale strings on `expo-camera` and `expo-image-picker`
  config plugins (used as the actual prompt text on Android 13+)
- `expo-camera` `recordAudioAndroid: false` — explicitly opts out of mic

### eas.json
- Added `EXPO_PUBLIC_WORKER_URL` env var to all three build profiles (dev /
  preview / production) — single place to set the Worker URL per build
- Production profile gets `autoIncrement: true` — bumps the Android
  versionCode automatically on every build (no more manual edits)
- Added `channel: "preview"` and `channel: "production"` for EAS Update
- `submit.production.android.track` changed from `production` to `internal`
  with `releaseStatus: "draft"` — safer default; promote to production
  manually inside Play Console after testing

### New documentation in `docs/`
- **`privacy-policy.md`** — accurate to actual implementation. Covers what's
  collected (nothing server-side), what's sent (photo + prompt to AI proxy),
  third-party processors (Cloudflare + Anthropic), retention (none on our
  side), permissions (camera + internet only), user rights (delete in-app).
  Written without legal boilerplate fluff.
- **`play-data-safety.md`** — fill-in script for the Play Console Data Safety
  form. Every answer mapped to an actual data flow. Includes guidance on
  service-provider processing vs sharing, and notes on what to update if/when
  Sentry, RevenueCat, Supabase, or TrueLayer ship.
- **`play-store-listing.md`** — title (28 chars), short description (76 chars),
  full description (~2,400 chars). Tuned against the four researched
  competitors; leads with "no lost receipts", line items, honest free tier,
  dark mode, regional tax. Includes "What's new" copy, content rating
  answers, contact details template.
- **`play-store-assets.md`** — exact specs and design briefs for icon
  (512×512), feature graphic (1024×500), and 6 phone screenshots. Lists
  exactly what to put on each screenshot and how to set up the device data.
- **`pre-launch-checklist.md`** — 14-section manual test plan covering cold
  start, onboarding, capture, manual entry, edit, region/tax behaviour,
  filters, stats, export, settings, network failure, permission denial,
  backup, performance on low-end, crash test. Plus a build checklist.
- **`release-runbook.md`** — single-page index of every doc + step-by-step
  release flow (Cloudflare Worker deploy → asset replacement → EAS init →
  build → Play Console submission → post-launch). Includes quick-reference
  build commands.

### What's still required from you (not code)
- Buy a domain (e.g. `tallyshot.app`)
- Set up an email address at that domain
- Host the privacy policy at a public URL
- Replace the icon, adaptive icon, splash, and screenshots with real designs
- Pay the £20 Play Console developer fee
- Run `wrangler deploy` for the Worker
- Run `eas init` and `eas build --platform android --profile production`

### Verification
- `npx tsc --noEmit` → 0 errors
- `npx expo export --platform android` → clean bundle

---

## Slice 4: Region-aware tax + Line items + Free tier polish + New onboarding

Implements all five Checkpoint 3 features in one push.

### Region + tax mode
- `TaxMode` type: `'inclusive' | 'exclusive'`
- `Region` type with 7 presets (GB / EU / US / AU / NZ / CA / other) — each
  bundles flag + currency + tax mode + tax label (VAT / GST / Sales tax)
- Auto-detect from device locale on first run via `NativeModules` (best-effort,
  falls back to GB)
- Settings: new "Region" section with all 7 options, plus a "Tax mode" override
- Worker prompt now embeds the tax mode + label so Claude knows whether the
  receipt's `total` already contains tax. **Counters the Saldo Apps GST
  double-count bug** — most-cited 1★ pattern in the category
- Receipt detail shows "VAT (included)" or "Sales tax" labels per region

### Line items
- Review screen: full line items editor with add / remove / edit
  (description / qty / unit price / line total). Auto-recalcs total when qty
  or unit price changes.
- Pre-populates from AI extraction when available
- CSV export: new "Line Items Count" + "Line Items" columns. Format:
  `2x Coffee @ GBP 3.50; 1x Croissant @ GBP 2.50`. Single-row-per-receipt
  preserved for spreadsheet compatibility.
- Receipt detail: line items list (already present) updated to use new tokens

### Transparent free tier
- Receipts list header: "X AI scans left" badge under the Scan button (free users)
- Settings privacy section now explicitly states: "No ads. No tracking. No
  analytics SDKs. No account required."
- Free plan card phrased as "X of Y AI scans **left**" instead of "used"
- No new modals, no upsells. The `isPro` flag stays hardcoded to `true` until
  RevenueCat is wired in

### Zero-to-organised onboarding
- Replaces the 3-step intro with a 4-step flow:
  1. **Welcome** — brand + tagline ("Zero to organised in 30 seconds") +
     4-feature grid
  2. **Region** — pick region with flag, sets currency + tax mode + tax label
  3. **Permissions** — camera (and optional photo library) with explanation
  4. **Free tier** — explicit list of what's free forever
- Skippable from step 2 onward via top-right Skip button
- Back button on steps 2–4
- All steps use the new tokens; CTAs are amber

### API changes
- `extractReceiptData(uri, taxMode, taxLabel)` — now requires tax context.
  Updated callers in processing + receipt detail screens.

### Files touched
- `src/types/index.ts` — `TaxMode`, `Region`, `REGION_PRESETS`, `REGION_ORDER`
- `src/stores/appStore.ts` — region/taxMode/taxLabel + locale auto-detect
- `src/services/extraction.ts` — region-aware system prompt
- `src/services/export.ts` — CSV line items columns
- `app/processing.tsx` — pass tax context to extraction
- `app/review/[id].tsx` — line items editor + tax label in form
- `app/receipt/[id].tsx` — pass tax context, show tax label
- `app/(tabs)/index.tsx` — scans-left badge
- `app/(tabs)/settings.tsx` — region picker + tax mode override + privacy line
- `app/onboarding/index.tsx` — full 4-step rewrite

### Verification
- `npx tsc --noEmit` → 0 errors
- `npx expo export --platform android` → clean bundle

---

## Slice 3B: Theme rollout across all screens

After approving the receipt-screen showcase in Slice 3A, propagated the
Crunchr-style dark + teal + amber design language to every remaining screen.

### Refactored
- **Tab bar** — surface bg, teal active tint, top border in `border` token,
  Inter labels.
- **Receipts list** — token-based dark, custom search input (no more Paper
  Searchbar), token chips with `tinted` variant for needs-review, deductible
  green dot indicator next to merchant names, accent icons in card avatars.
- **Stats** — page title, segmented period switcher (custom, not Paper),
  hero total card with massive amber amount, teal-tinted category bars,
  rank badges in accent.
- **Settings** — sectioned cards with section labels, free/pro plan card,
  Quick Scan toggle row, theme/currency pickers as `OptionRow`s with check
  marks in accent, danger-zone red card for Delete all data.
- **Onboarding** — full dark, large 64pt teal-tinted icon, big Inter
  ExtraBold title, amber CTA button, amber active dot.
- **Review screen** — sectioned dark form, custom token-based inputs,
  needs-review banner, tax-deductible toggle card with green tint when on,
  category dropdown, amber save CTA.
- **Processing screen** — error state now a proper card on dark background
  with amber error icon, amber CTA button, outlined retry button.
- **Export screen** — token-based pills, format toggle as segmented row,
  template picker with accent border on selected, dark inputs.
- **Preview screen** — dark stats bar, dark fallback card with amber PDF
  icon, edit/share action bar in surface tones.

### What didn't change
- Camera screen (already fully dark, no changes needed)
- DB layer, services, store
- All functionality preserved

### Files touched
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/stats.tsx`
- `app/(tabs)/settings.tsx`
- `app/onboarding/index.tsx`
- `app/review/[id].tsx`
- `app/processing.tsx`
- `app/export.tsx`
- `app/preview.tsx`

### Verification
- `npx tsc --noEmit` → 0 errors
- `npx expo export --platform android` → clean bundle

---

## Slice 3A: Theme system + Receipt screen redesign

Implements Checkpoint 2 of the new design pass.

### New
- **`src/theme/index.ts`** — single source of truth for colour. Exports
  `darkTokens`, `lightTokens`, `useThemeTokens()` hook, `useActiveScheme()`.
  Tokens are semantic, not raw colour: `background / surface / surfaceElevated /
  border / textPrimary / textMuted / textSubtle / accent / cta / success /
  warning / danger`, plus receipt-specific `needsReview / deductible`.
- **Crunchr-style palette**: dark navy bg `#0d1117`, surface `#1c2128`,
  teal accent `#14b8a6`, amber CTA `#f5a623`. Light mode mirror palette
  available.
- **Default theme is now `dark`** — light mode still selectable in Settings.
- **Receipt screen rewritten** as the showcase for the new system. Layout:
  280px hero image with "tap to edit" badge → optional needs-review banner →
  hero card (category icon + merchant + total + deductible chip + edit button)
  → details card (subtotal/tax/currency/payment/deductible rows, each with
  pencil affordance, ≥48pt tap targets) → line items list → notes →
  primary action stack (Retry AI / Edit / Delete).
- All Receipt screen tap targets ≥ 44pt. Body text contrast meets WCAG AA
  (`#f0f4f9` on `#1c2128` = 12.6:1).

### What didn't change
- Other screens still use Paper's theme.colors and will inherit the new
  dark surfaces but retain hardcoded accent colours where they still exist.
  Roll-out across other screens is the next slice (awaiting your approval).

### Files touched
- `src/theme/index.ts` (new)
- `src/stores/appStore.ts` — default `theme: 'dark'`
- `app/_layout.tsx` — Paper theme wired to new tokens, dark default
- `app/receipt/[id].tsx` — full rewrite

---

## Slice 2B: PDF reports v2

Implements competitor-parity Feature 3 (Create PDF reports in seconds) from
the Easy Expense headline list.

### New behaviour
- **Three PDF templates**:
  - **Tax submission** — grouped by category with deductible totals per group
    and a green dot beside every deductible row
  - **Reimbursement** — chronological list with totals only, ideal for sending
    to an employer or client
  - **Detailed** — every line item from every receipt with full breakdown
- **Quick-pick date ranges**: This month / Last month / This quarter / This year /
  Custom (with manual From/To when Custom is selected)
- **Custom report title** — defaults to `<Template> — <DateRange>`
- **Optional notes block** — appears as a yellow callout in the rendered PDF
- **Preview screen** — generated PDF is rendered in a WebView before share.
  Stats bar at top shows receipt count / total / deductible. Buttons: Edit (back),
  Share. iOS uses native PDF rendering; Android falls back to a friendly
  "ready to share" card because Android WebView can't render local file:// PDFs.
- **Visual polish**: PDF templates now share consistent header / summary grid /
  footer styling. Generation timestamp added to footer.

### New API
- `ReportTemplate = 'tax' | 'reimbursement' | 'detailed'`
- `TEMPLATE_INFO` map for UI rendering
- `buildPdfHtml(opts)` — pure HTML generator
- `generatePDF(opts)` — returns file URI without sharing
- `sharePDFFile(uri)` — share an existing PDF file
- `sharePDF()` retained as compat shim (still uses tax template)

### New dependency
- `react-native-webview` — Expo Go compatible, used for PDF preview rendering

### Files touched
- `src/services/export.ts` — full refactor into template strategy
- `app/export.tsx` — rewrite with quick-picks + template picker + custom fields
- `app/preview.tsx` — new
- `app/_layout.tsx` — register preview route

---

## Slice 2A: Quick Scan + Tax Deductions

Implements competitor-parity Features 1 (fastest scanner) and 2 (maximize
tax deductions) from the Easy Expense headline list.

### Schema changes
- `receipts.is_tax_deductible INTEGER NOT NULL DEFAULT 0` — new boolean column.
  Migration via `PRAGMA table_info` check + `ALTER TABLE ADD COLUMN`. Existing
  rows backfilled: receipts in Travel / Transport / Accommodation / Office & Tech
  default to deductible=1; everything else stays at 0.
- New index: `idx_receipts_deductible`.

### Behaviour changes
- **Quick Scan mode** (Settings → Capture). When enabled, confident extractions
  skip the Review screen and save directly. "Confident" = merchant non-empty,
  total > 0, subtotal+tax ≈ total, and date is plausible. Default off.
- **Worker pre-warm**: Capture screen fires an `OPTIONS` request to the Worker
  on mount to mask the 1–2s cold-start. Best-effort, silent.
- **Image quality** dropped 0.85 → 0.6 for upload — halves payload size.
- **Tax-deductible toggle** on Review and Receipt Detail. Auto-defaults based
  on category, but only if the user hasn't manually changed it.
- **"Tax deductible" filter chip** on Receipts list.
- **"Tax-deductible this period" card** on Stats screen (only shown when count > 0).
- **CSV export**: new "Tax Deductible" column ("Yes"/"No").
- **PDF export**: deductible total card in header; deductible receipts marked
  with a green ● in the rows table.

### New API surface
- `getMonthlyDeductibleTotal(yearMonth)` — Stats data
- `prewarmWorker()` — fire-and-forget HTTP OPTIONS warmup
- `isExtractionConfident(result)` — Quick Scan gate
- `useAppStore: { quickScan, setQuickScan }`
- `CATEGORY_DEDUCTIBLE_DEFAULTS` — category → boolean map

### What didn't change
- No new dependencies installed
- No native modules
- Worker contract unchanged (just lower image quality from client)
- Existing manual entry / needs-review flows unchanged

### Files touched
- `src/types/index.ts`
- `src/db/schema.ts`
- `src/db/receipts.ts`
- `src/services/extraction.ts`
- `src/services/export.ts`
- `src/stores/appStore.ts`
- `app/capture.tsx`
- `app/processing.tsx`
- `app/review/[id].tsx`
- `app/receipt/[id].tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/stats.tsx`
- `app/(tabs)/settings.tsx`

---

## Slice 1: "Never lose a receipt"

Implements the core differentiator from the Phase 3 backlog. Single coherent slice
that ships the headline promise: receipts are never lost to AI failures.

### Schema changes
- `receipts` table: added `status TEXT NOT NULL DEFAULT 'complete'` column.
  Values: `complete` | `needs_review`. Index on `status` for fast filtering.
  Safe migration via idempotent `ALTER TABLE ADD COLUMN`. Existing user data preserved
  — every existing row defaults to `complete`.

### Behaviour changes
- **AI extraction failure flow**: previously dropped the user on a manual-entry screen
  and discarded the photo if they cancelled. Now offers to save the receipt as
  `needs_review` with the photo attached, preserving it across app restarts.
- **Receipt deletion**: now deletes the underlying image file from disk
  (`expo-file-system`). Best-effort — silently ignores already-missing files.
- **Capture screen**: monthly AI limit no longer locks the user out — the limit
  banner now reads "Monthly AI limit reached — you can still add receipts manually"
  and a new "Add manually" button is always visible below the shutter.
- **Review screen**: warns inline if `subtotal + tax` doesn't match `total`
  (within 2% / 5p tolerance). Non-blocking. Direct counter to Easy Expense's
  recurring "tax confused for total" complaint.
- **Receipt detail**: shows a yellow "Needs review" banner and a "Retry AI" button
  for receipts whose extraction failed. Successful retry promotes status to `complete`.
- **Receipts list**: yellow needs-review badge on cards; new "Needs review (N)" filter
  chip appears when the count is > 0.
- **Settings**: new "Delete all data" action with two-step confirmation. Clears all
  rows and the receipts/ image directory.

### New API surface
- `setReceiptStatus(id, status)` — promote/demote a row's status
- `getNeedsReviewCount()` — dashboard badge counter
- `clearAllUserData()` — wipe rows + images
- `clearAllReceipts()` — drop rows only (kept for testing)

### What didn't change
- No new dependencies installed
- No native modules
- Zustand store unchanged
- Worker contract unchanged
- Export (CSV/PDF) unchanged

### Files touched
- `src/types/index.ts`
- `src/db/schema.ts`
- `src/db/receipts.ts`
- `app/processing.tsx`
- `app/review/[id].tsx`
- `app/receipt/[id].tsx`
- `app/capture.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/settings.tsx`
