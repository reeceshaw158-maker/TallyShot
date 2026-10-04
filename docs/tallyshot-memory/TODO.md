# TallyShot — Master To-Do List

## STATUS KEY
[ ] = Not started
[~] = In progress / partially done
[x] = Complete
[!] = Blocked — needs decision

> **Reconciled against the shipped code on 2026-09-19.** The original brief
> assumed a greenfield scanner. It is not — Slices 11 and 12 already shipped
> most of Phase 2, Phase 3 and Phase 5. Ticks below reflect what is actually in
> the repo, verified file by file. Bug numbers reference BUGS.md.

---

## PHASE 1 — FOUNDATIONS (current phase)

### Memory System
[x] Create /docs/tallyshot-memory/ folder
[x] Create PROJECT.md
[x] Create ARCHITECTURE.md
[x] Create TODO.md
[x] Create BUGS.md
[x] Create APIS.md
[x] Create SESSIONS.md

### Audit
[x] Read CHANGES.md
[x] Read package.json
[x] Audit barcode scanner code
[x] Audit receipt scanner code
[x] Audit all screens for design consistency
[x] Identify all broken features
[x] Identify all white/inconsistent screens
[x] Write full diagnosis report
[!] Resolve brand palette conflict (teal brief vs indigo/amber code)
[ ] Decide: root TODO.md merges into this file

---

## PHASE 2 — FIX THE SCANNER

### Barcode Library
[x] Research best Expo-compatible barcode library — expo-camera (ML Kit)
[x] Confirm Expo Go compatible
[x] Install chosen library
[x] Remove old scanner code — vision-camera + nitro uninstalled
[x] Wire new library fully

### Camera Permissions
[x] Android camera permission handling — canAskAgain + Settings route
[~] iOS camera permission handling — same code path, never tested (no iOS build)
[x] Permission denied state with Settings link
[x] Permission explanation before system prompt — onboarding permissions step
[x] Never crash on any permission state — a permanent denial now routes to Settings or manual entry

### Scanner Viewfinder UX
[x] Full screen camera, edge to edge
[x] Scan box with glowing border — colour pending palette decision
[x] Corner bracket markers with pulse animation
[x] Smooth scan line animation (top to bottom)
[x] Vignette outside scan box
[x] "Point at a barcode" instruction text
[x] Text changes on detection — "Hold still…" mid-lock, digits once locked
[x] Wide detection zone — the whole frame is scanned, the box is guidance only
[!] Continuous auto-focus — impossible on Android; expo-camera's `autofocus` is
    iOS-only. 3-identical-reads (`STABLE_READS`) is the shipped proxy.
[x] Torch toggle top right
[ ] Auto torch prompt in low light

### Lock-on Animation
[x] Corner brackets snap inward on detection — driven by lockProgress
[x] Border flash on lock — one white wash, amber→green corners
[x] Haptic tick on successful scan
[x] Instant transition to result

### Manual Fallback
[x] "Enter barcode manually" button
[x] Clean manual entry screen — app/manual-barcode.tsx, with check-digit validation
[x] Numeric keyboard

### Receipt Scanner
[x] Portrait ratio scan box
[x] Lock-on animation — AI detection box with spring pop
[x] Slow scan line (AI "reading" feel)
[x] "Reading receipt…" state — app/processing.tsx
[~] Slide-up result card with spring physics — card exists, no spring entry

---

## PHASE 3 — GLOBAL PRODUCT DATABASE

### Data Sources
[x] Research all available APIs
[x] Open Food Facts integration (v3)
[x] Open Beauty Facts integration
[x] Open Products Facts integration
[x] Open Pet Food Facts integration
[x] General UPC/EAN fallback — UPCitemdb free tier
[x] Waterfall logic implemented
[x] All API calls have 8s timeout + retry — 2 attempts, 400ms/800ms backoff

### Product Data
[x] Product name, brand
[ ] Manufacturer
[~] Country of origin — name only, no flag
[x] Barcode number and format
[x] Product image (with fallback)
[x] Category badge auto-detected
[x] Full ingredients list
[x] Each E-number / additive explained in plain English — curated table, ~150 entries, no AI
[x] All 14 UK allergens checked and flagged
[x] Allergens shown as amber pill tags
[~] EU fragrance allergens (cosmetics) — 6 concerns implemented, not the 26
[x] Nutri-Score A–E (food) — large and prominent
[x] Traffic light colours: Fat/Sat/Sugar/Salt (UK FSA)
[x] Full nutrition panel (per 100g + per serving)
[x] NOVA group (processing level)
[x] ABV percentage (alcohol)
[x] UK units per serving and per multipack (NHS formula)
[x] Calories per unit (alcohol) — 55 kcal/unit, from alcohol alone
[x] Vegan / Vegetarian badges — declared vs derived distinguished
[x] Gluten-free badge
[x] Organic badge
[x] Halal / Kosher badge
[x] Palm oil flag — contains / may contain
[x] Eco-Score A–E if available
[x] Cruelty-free badge (cosmetics) — plus Fairtrade
[x] INCI list with photo-transcription fallback (cosmetics)

### AI Intelligence Layer (Claude API)
[!] ALL BLOCKED by BUG-002 (no API credit). BUG-001 fixed 2026-09-19.
[x] Plain English guidance line — shipped, but rules-based not AI (nutrition.ts)
[ ] E-number explanations per ingredient
[x] Key watch-outs personalised summary — user dietary flags, rules-based
[ ] TallyShot verdict (one honest sentence)
[x] Alcohol unit awareness note — factual, no health framing
[ ] Cosmetics skin intelligence summary

### Not Found Flow
[x] Clean "Not in any database yet" screen
[x] Manual entry form (receipt details)
[x] Save to personal product history
[ ] Contribute to Open Food Facts option

### Error States
[x] No internet connection — own card, Try again, no cached miss
[x] Product not found anywhere
[~] Not a consumer product — non-retail symbologies skip the chain
[x] API timeout
[x] Camera permission denied
[x] Scan failed / unreadable
[x] Rate limit hit — degrades to "couldn't check everything"
[x] Server error

---

## PHASE 4 — PRODUCT RESULT SCREEN

### Entry Animation
[x] Spring physics slide up from bottom
[x] Product image fade + scale 0.96→1.0 (whole card)
[ ] Staggered data field fade-in
[x] Under 600ms total

### Layout
[x] Full-width product image header
[x] Name, brand, category badge row
[x] Nutri-Score (food) — large, prominent
[x] Traffic light grid
[x] Allergen pills — amber, prominent
[x] Ingredients collapsible (already shipped; earlier audit entry was wrong)
[ ] AI verdict card section (blocked, see Phase 3)
[x] Health/diet badge row
[x] Primary CTA always visible — "Add to a receipt"
[x] "Scan another" secondary button
[~] Share button — now shares the full findings as text. Branded IMAGE card needs react-native-view-shot, which breaks Expo Go — flagged, awaiting decision.

---

## PHASE 5 — SCAN HISTORY

[x] Grid view (product images as hero)
[x] List view
[x] List/grid toggle
[~] Filters — category + search by name/brand/digits; no Logged/Unlogged
[x] Tap = instant cached result
[x] Swipe left = delete (5-second undo)
[ ] Swipe right = log expense
[x] Pull to refresh
[x] Empty state: helpful and action-oriented

---

## PHASE 6 — COMPARE MODE (shipped 2026-09-19)

[x] Pick two products from scan history (scanning two fresh not needed - history holds them)
[x] Side-by-side comparison screen — app/compare.tsx
[x] Compare: nutrition, Nutri-Score, Eco-Score, NOVA, allergens, additives, ABV/units, certifications, pack. Price not included — only AI-guessed prices exist and they were removed as misleading.
[!] AI comparison verdict — blocked by BUG-002. A rules-based arithmetic summary ships instead, and may be the better answer anyway.

---

## PHASE 7 — PERFORMANCE + STORE READINESS

### Caching
[x] Research MMKV vs SQLite vs AsyncStorage — expo-sqlite chosen (Expo Go safe)
[x] Implement chosen solution
[x] Repeat scans instant (no network call)
[x] Offline-first for all cached products
[ ] Storage size management

### Performance
[ ] Cold start under 2 seconds — never measured
[ ] Scanner ready within 1 second — never measured
[x] Cached result under 1 second
[ ] No ANR states — never profiled
[ ] No memory leaks on camera screen — never profiled

### Play Store
[x] Target SDK 36 via expo-build-properties — NOT yet verified against an EAS build
[x] Data Safety form ready — docs/play-data-safety.md
[x] Camera permission declaration
[x] Remove RECORD_AUDIO from app.json permissions
[!] Sentry crash reporting — native module breaks Expo Go AND needs a DSN from an account that does not exist. Two blockers, flagged.
[x] All console.log removed — migration warnings gated on __DEV__
[ ] All strings in constants file

### Accessibility
[ ] All tap targets minimum 44dp — never audited
[ ] WCAG AA contrast on all text — never audited
[x] Screen reader labels on icon-only controls across every screen
[ ] Reduced motion respected — not implemented

### Final Polish
[!] Zero white backgrounds — blocked on the palette decision; light mode is
    currently a deliberate, shipped feature (#fafaf7)
[x] Zero placeholder text visible
[~] Every screen: empty state
[x] Every screen: error state — ErrorBoundary on the root layout covers all routes
[~] Every screen: skeleton loading state — 2 of 8 screens (stats, scan history)
[~] All animations spring-based — 5 springs, rest are timing curves
[x] All haptics intentional
[x] CHANGES.md up to date
