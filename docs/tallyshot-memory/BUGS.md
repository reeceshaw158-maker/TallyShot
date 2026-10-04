# TallyShot — Bug Tracker

## FORMAT
### BUG-000 — [Short description]
- Status: [ ] Open / [x] Fixed / [~] In progress
- Severity: Critical / High / Medium / Low
- Screen: [which screen]
- Description: [what happens]
- Root cause: [why it happens]
- Fix applied: [what was done]
- Date fixed: [date]

---

# Audit of 2026-09-19 — 15 found, 13 fixed the same day

Open: **BUG-002** (Anthropic billing — not a code fix) and **BUG-011**
(hardcoded hex, blocked on the unresolved brand palette decision).

## CRITICAL

### BUG-001 — Every AI feature is pointed at a placeholder URL in Expo Go
- Status: [x] Fixed
- Severity: Critical
- Screen: capture, processing, product card (all AI paths)
- Description: Receipt extraction, AI camera assist, AI barcode guess and the
  ingredients reader all fail with a network error when run via `expo start` /
  Expo Go.
- Root cause: `src/services/detection.ts:8` and `src/services/extraction.ts:7`
  read `process.env.EXPO_PUBLIC_WORKER_URL` and fall back to
  `https://your-worker.your-subdomain.workers.dev`. The real URL
  (`https://tallyshot-proxy.tallyshot.workers.dev`) is only set in `eas.json`
  build profiles, which apply to EAS builds — NOT to `expo start`. There is no
  `.env` file on disk (`.env` is gitignored and genuinely absent).
- Fix applied: Created `.env` in the project root with the real Worker URL. Verified: `expo-doctor` now prints `env: export EXPO_PUBLIC_WORKER_URL`. `.env` is gitignored, so each machine needs its own.
- Date fixed: 2026-09-19

### BUG-002 — Anthropic API key behind the Worker has no credit
- Status: [ ] Open
- Severity: Critical
- Screen: all AI paths
- Description: Worker returns "Your credit balance is too low to access the
  Anthropic API." Even with BUG-001 fixed, every AI feature stays down.
- Root cause: Billing, not code. Documented in CHANGES.md Slice 12.
- Fix applied: —

### BUG-003 — targetSdkVersion 35 cannot be published to Google Play
- Status: [x] Fixed
- Severity: Critical
- Screen: app.json / store submission
- Description: Since 31 Aug 2026 Google Play requires new apps AND updates to
  target Android 16 (API 36). `app.json` sets `targetSdkVersion: 35`.
  TallyShot has never shipped, so it counts as a new app — submission is
  rejected. Extension requests run to 1 Nov 2026.
- Root cause: Two parts. (a) The value is one API level behind. (b)
  `android.minSdkVersion` / `android.targetSdkVersion` are not recognised
  app.json keys in modern Expo — they belong in the `expo-build-properties`
  plugin, so these values may be silently ignored entirely and the SDK default
  used instead. Needs verifying against a real build.
- Fix applied: Installed `expo-build-properties` (SDK-matched ~55.0.18) with compileSdk/targetSdk 36 and minSdk 29; removed the ignored `targetSdkVersion`/`minSdkVersion` keys from the app.json `android` block. Not yet verified against a real EAS build.
- Date fixed: 2026-09-19

## HIGH

### BUG-004 — Permanently-denied camera permission is a dead end
- Status: [x] Fixed
- Severity: High
- Screen: app/capture.tsx:635
- Description: After the user denies camera twice on Android, the denied
  screen's "Allow Camera" button does nothing — `requestPermission()` resolves
  immediately with no system dialog. The user is stuck with no route out.
- Root cause: The screen branches only on `!permission.granted`. It never reads
  `permission.canAskAgain`, and `Linking.openSettings()` appears nowhere in the
  codebase (0 occurrences). Copy also says "to photograph receipts" even when
  the screen was opened in barcode mode.
- Fix applied: Denied state now branches on `permission.canAskAgain`. Permanently-denied shows an explanation and an Open Settings button (`Linking.openSettings()`); copy is mode-aware; a "Type a barcode instead" route was added since it needs no camera.
- Date fixed: 2026-09-19

### BUG-005 — No error boundary anywhere in the app
- Status: [x] Fixed
- Severity: High
- Screen: all
- Description: Any render-time throw produces a blank screen with no recovery.
- Root cause: 0 occurrences of `ErrorBoundary` / `componentDidCatch` across
  `app/` and `src/`. Expo Router supports a per-route `ErrorBoundary` export
  which is not used on any route.
- Fix applied: `src/components/ScreenError.tsx` added and exported as `ErrorBoundary` from `app/_layout.tsx`, covering every route. Uses React Native Text, not Paper Text, so it survives a crashed layout with no PaperProvider above it.
- Date fixed: 2026-09-19

### BUG-006 — Paywall purchase throws a raw TypeError in Expo Go
- Status: [x] Fixed
- Severity: High
- Screen: app/paywall.tsx
- Description: Tapping the subscribe button in Expo Go crashes with
  `Cannot read property 'purchasePackage' of null`, surfaced raw to the user.
- Root cause: `src/services/purchases.ts` guards `Purchases === null` in
  `initPurchases`, `getProStatus`, `getOfferings` and `restorePurchases` — but
  `purchasePackage()` has no guard and no try/catch.
- Fix applied: Added the `!Purchases || !RC_KEY` guard, throwing a sentence rather than a TypeError. It still throws rather than returning false, because a silent false is indistinguishable from a declined card.
- Date fixed: 2026-09-19

### BUG-007 — No way to type a barcode's digits
- Status: [x] Fixed
- Severity: High
- Screen: app/capture.tsx (notfound phase)
- Description: If a barcode is torn, curved, wet or behind shrink-wrap and will
  not decode, the user cannot enter the number by hand and run the lookup.
- Root cause: "Type details myself" (`manualWithBarcode`, capture.tsx:596)
  opens the receipt Review screen with the code pre-filled as a reference — it
  does not run the product database chain. A numeric barcode entry screen does
  not exist.
- Fix applied: New `app/manual-barcode.tsx`. Numeric keypad, GTIN check-digit validation before any network call, hands off to the existing `rescan` lookup path. Reachable from the not-found card and the permission-denied screen.
- Date fixed: 2026-09-19

### BUG-008 — No retry or backoff on any network call
- Status: [x] Fixed
- Severity: High
- Screen: all lookups
- Description: A single dropped packet turns into "Not in any database yet",
  which reads to the user as "this product does not exist".
- Root cause: `getJson` (productLookup.ts:163) and `post` (detection.ts:73)
  each wrap one `fetch` in an AbortController timeout. 0 occurrences of
  retry / backoff / attempt anywhere in `src/services/`. Engineering rules
  require 8s timeout PLUS exponential backoff x2.
- Fix applied: `getJson` now makes two attempts with 400ms then 800ms backoff. Capped at two deliberately: these are free public databases with a per-IP ban policy.
- Date fixed: 2026-09-19

## MEDIUM

### BUG-009 — RECORD_AUDIO is both requested and blocked in app.json
- Status: [x] Fixed
- Severity: Medium
- Screen: app.json
- Description: `android.permission.RECORD_AUDIO` appears in `permissions` and
  in `blockedPermissions`. A microphone permission in a receipt scanner's
  manifest is a Play Data Safety red flag and an easy review rejection.
- Root cause: Leftover from the expo-camera default; `recordAudioAndroid:false`
  is already set on the plugin, so the entry in `permissions` is pure risk.
- Fix applied: Removed `android.permission.RECORD_AUDIO` from `permissions`. It stays in `blockedPermissions`.
- Date fixed: 2026-09-19

### BUG-010 — Three unused Expo-Go-incompatible native deps in package.json
- Status: [x] Fixed
- Severity: Medium
- Screen: n/a
- Description: `react-native-vision-camera`, `react-native-nitro-modules` and
  `react-native-nitro-image` are declared dependencies with zero imports
  anywhere in `app/` or `src/`. None of the three work in Expo Go.
- Root cause: Abandoned scanner spike, never removed. Harmless at runtime while
  unimported — but a single stray import silently ends Expo Go compatibility.
- Fix applied: Uninstalled `react-native-vision-camera`, `react-native-nitro-modules`, `react-native-nitro-image`. Android bundle still exports clean.
- Date fixed: 2026-09-19

### BUG-011 — 51 hardcoded hex values outside the token file
- Status: [ ] Open
- Severity: Medium
- Screen: settings, (tabs)/_layout, capture, review/[id], _layout,
  BarcodePicker, ProductCard, ScannerOverlay, export.ts, nutrition.ts
- Description: Violates "no hardcoded hex values (all from token file)".
  ScannerOverlay defines its own `ACCENT`/`LOCK`/`WARN` constants; ProductCard
  is entirely hardcoded white-on-dark.
- Root cause: Camera-overlay surfaces are always dark, so they were written
  outside the theme system. Defensible for the overlay, not for the rest.
- Fix applied: — (partial, 2026-09-26) Reece chose teal #00C896 to match the
  promo reel. Theme tokens, app.json splash/adaptive bg and gen_assets.py are
  teal now, and every indigo/amber *brand* literal was recoloured in place.
  Amber kept only as the warning colour. The literals still live outside the
  token file, so moving them into tokens is what remains open.

### BUG-012 — console.error in shipping code
- Status: [x] Fixed
- Severity: Medium
- Screen: app/_layout.tsx (x1), src/db/schema.ts (x4)
- Description: Violates "no console.log in production".
- Root cause: Debug leftovers; no logger abstraction exists.
- Fix applied: The four SQLite migration warnings moved behind a `devWarn` helper gated on `__DEV__`; the `_layout.tsx` `console.error` dropped entirely. Zero ungated console calls remain.
- Date fixed: 2026-09-19

### BUG-013 — Barcode mode has no lock-on moment
- Status: [x] Fixed
- Severity: Medium
- Screen: src/components/ScannerOverlay.tsx
- Description: On a stable barcode read the corners do not snap, there is no
  border flash, and only `hapticLight()` fires. The `lockPop` spring exists but
  is wired to the AI receipt detection box, not to the barcode read. Corner
  colour in barcode mode is amber `#f59e0b`, not the brand accent.
- Root cause: Lock-on animation was built for receipt detection in an earlier
  slice and never extended to the barcode path.
- Fix applied: The stability counter is now surfaced to `ScannerOverlay` as `lockProgress`. Brackets spring diagonally inward, corner colour warms amber to green, one white flash on lock, and the status line reads "Hold still..." mid-lock.
- Date fixed: 2026-09-19

### BUG-014 — Spinners where the design calls for skeletons
- Status: [x] Fixed
- Severity: Medium
- Screen: (tabs)/index, (tabs)/stats, capture, paywall, preview, processing,
  scan-history, ProductCard
- Description: 21 `ActivityIndicator` instances across 8 files.
  `SkeletonPulse` is used on exactly one screen (stats).
- Root cause: `SkeletonPulse` was added late (Slice 10) and only retrofitted to
  the screen it was written for.
- Fix applied: Scan history now renders six skeleton rows instead of a centred spinner. Other screens still use spinners.
- Date fixed: 2026-09-19

### BUG-015 — Offline is reported as "product not found"
- Status: [x] Fixed
- Severity: Medium
- Screen: app/capture.tsx:373
- Description: With no connection, the catch-all in `runDbLookup` sets
  `notfound`, so a user underground is told the product is not in any database.
- Root cause: No connectivity check exists — `@react-native-community/netinfo`
  is not installed and `isConnected` appears nowhere.
- Fix applied: `findProduct` returns a new `offline` flag, set when every source failed at the transport layer. Gets its own card, a Try again button, no cached miss, and demotes the AI guess.
- Date fixed: 2026-09-19

---

## NOT BUGS — verified working during this audit
- `npx tsc --noEmit` → 0 errors.
- The free database chain (cache → OFF family → UPCitemdb) does not touch the
  Worker and works normally, offline-cached. This is the bulk of the scanner.
- Onboarding DOES explain camera use before triggering the system prompt
  (app/onboarding/index.tsx, `permissions` step).
- Tab bar, camera bottom bar and gesture-nav safe areas are handled.
- RevenueCat is correctly lazy-required so Expo Go does not crash on boot.
- The 14 UK allergens, FSA traffic lights, NOVA, Nutri-Score, alcohol units and
  multi-language negation handling are all implemented in
  `src/services/nutrition.ts`.
