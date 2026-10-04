# TallyShot — Session Log

## FORMAT
### SESSION [date] — [short description]
- What was built:
- What was changed:
- Decisions made:
- What's next:
- Blockers:

---

### SESSION 2026-09-19 (part 5) — Slice 16: backlog clearance

**What was built**
- `src/services/additives.ts` — ~150 E-numbers explained in plain English.
- Per-serving nutrition panel (scaled from OFF `serving_quantity` only).
- Full-width hero product photo.
- Scan history grid view + list/grid toggle.
- Share now sends the findings, not just the name.
- Accessibility labels on the remaining icon-only controls.
- `expo install --fix`: 18 packages to their SDK 55 pins.

**Decisions made**
- **E-numbers are a curated table, not an AI call.** A hallucinated additive
  description is a safety problem; this is the part of the card a vegetarian or
  someone sulphite-sensitive acts on. It also works offline, costs nothing, and
  these facts do not change.
- Additive `note` fields carry only label statements (the Southampton Six
  warning, phenylalanine, sulphites as declarable allergens) and sourcing facts
  (insect/egg/animal-derived). No health opinions.
- **Traffic lights are not repeated on the per-serving panel.** FSA colours are
  defined per 100g; recolouring against a serving would invent a rating scheme
  and present it as the official one.
- Per-serving figures come only from OFF's parsed `serving_quantity`. Parsing
  the free-text serving ourselves would be guesswork that silently multiplies
  every number on the panel.
- Unrecognised additive codes are still listed. Dropping them would
  misrepresent the product.

**Verification**
- `npx tsc --noEmit` → 0 errors
- `npx expo export --platform android` → clean bundle
- `npx expo-doctor` → **20/20** (was 19/20 — patch drift cleared)
- Third EAS preview APK: build 52236945

**Blockers — unchanged, still need Reece**
1. **Anthropic billing (BUG-002)** — all AI still down.
2. **Brand palette** — still indigo/amber; gates BUG-011 and Phase 4 polish.
3. **Branded share IMAGE card** — needs `react-native-view-shot`, breaks
   Expo Go. Flagged per the standing rule, not installed.
4. **Sentry** — breaks Expo Go AND needs a DSN. Not installed.

---

### SESSION 2026-09-19 (part 4) — Slice 15: Compare mode (Phase 6)

**What was built**
- `src/services/compare.ts` — pure comparison engine over two `ProductCard`s.
- `app/compare.tsx` — the side-by-side screen.
- `getScanById()` in `src/db/scanHistory.ts`.
- Compare selection mode in scan history (scales icon in the header).

**Decisions made**
- **Products come from scan history, not two fresh scans.** History already
  stores each card in full, so comparing needs no network and works offline.
  Requiring two live scans would have been slower and worse.
- **Highlighting is arithmetic only.** Lower number, earlier letter. Each
  ordered row states what winning means next to it, and the summary says
  outright that it is not a recommendation. This is the screen where a
  nutrition app is most tempted to give advice, and least able to defend it.
- **Allergens are not ordered.** Fewer is not better — it depends which
  allergen and which person.
- **Price is not compared.** The only prices in the system are AI guesses, and
  those were removed from database results in Slice 11 as misleading.
- **Two products, not N.** A third column does not fit a phone. Picking a third
  replaces the older pick rather than being refused.
- The AI comparison verdict stays blocked by BUG-002. The rules-based summary
  that shipped instead may be the better answer regardless.

**Verification**
- `npx tsc --noEmit` → 0 errors
- `npx expo export --platform android` → clean bundle
- Second EAS preview APK: build 593e6674

---

### SESSION 2026-09-19 (part 3) — Slice 14: badges, pills, entry animation

**What was built**
- Diet/certification/eco badge row on the product card (9 certifications plus
  palm-oil warnings), with `declared` vs `derived` provenance made explicit.
- Eco-Score beside Nutri-Score.
- Allergens rendered as amber pills instead of a comma-separated sentence.
- Calories per UK alcohol unit.
- Spring entry animation on the product card.
- Pull-to-refresh on scan history.
- Accessibility labels on every icon-only camera control.

**Decisions made**
- **`labels_tags` and `ingredients_analysis_tags` are never merged.** The first
  is a producer's claim, the second is OFF's reading of the ingredient list.
  Derived badges get an asterisk and a footnote. Telling someone with a
  religious or medical restriction "vegan" when the real answer is "we read the
  list and it looked vegan" is the most dangerous thing this card could do.
- Where a producer has claimed a certification, the derived version is
  suppressed rather than shown alongside it.
- The entry animation is keyed to `card.barcode`, not to mount — the component
  is reused between scans.
- Cache rows predating the new fields are backfilled on read, not discarded.

**Verification**
- `npx tsc --noEmit` → 0 errors
- `npx expo export --platform android` → clean bundle
- EAS preview APK build started: build 8e099610

---

### SESSION 2026-09-19 (part 2) — Slice 13: audit fixes

**What was built**
- `app/manual-barcode.tsx` — type a barcode by hand, with GTIN check-digit
  validation before any network call.
- `src/components/ScreenError.tsx` — exported as `ErrorBoundary` from the root
  layout, so it covers every route in the app.

**What was changed**
- `.env` created (gitignored) with the real Worker URL — this alone revived
  every AI code path in Expo Go. Verified via `expo-doctor`.
- `expo-build-properties` installed; compile/target SDK 36, min 29. The old
  `android.targetSdkVersion` keys in app.json were being ignored entirely.
- `RECORD_AUDIO` removed from app.json `permissions` (it was in both lists).
- Camera permission screen now distinguishes "not asked" from "permanently
  denied" and routes the latter to OS settings.
- `findProduct` gained an `offline` flag; a dead connection no longer reports
  "not in any database" and no longer caches a miss.
- `getJson` retries once with 400/800ms backoff.
- Barcode lock-on animation wired to the stability counter (`lockProgress`).
- Scan history loads with skeleton rows instead of a spinner.
- `purchasePackage` null guard; console calls gated on `__DEV__`.
- Three unused native deps uninstalled (vision-camera, nitro x2).

**Decisions made**
- **Kept the shipped indigo/amber palette.** The brand conflict is still
  unresolved and a re-skin is the one expensive, hard-to-reverse change in the
  bug list — so nothing here touches colour. BUG-011 stays open behind it.
- Retries capped at two attempts, not the "x2 backoff" the engineering rules
  imply could be more: OFF will IP-ban a client that retries hard, and a
  scanner hammering them on a flaky connection is exactly that client.
- `devWarn` gated on `__DEV__` rather than deleting the SQLite migration
  warnings — they are the kind of failure you want shouted at you in dev.

**Verification**
- `npx tsc --noEmit` → 0 errors
- `npx expo export --platform android` → clean bundle
- `npx expo-doctor` → 19/20

**Blockers**
1. **Anthropic billing (BUG-002)** — every AI feature is still down. Not a code
   fix. Receipt scanning cannot be tested until this is topped up.
2. **Brand palette** — still needs Reece's call. Blocks Phase 4 and BUG-011.
3. **Target SDK 36 is unverified.** The config is right but only an EAS build
   proves it lands in the manifest.
4. `expo-doctor` reports 18 packages at patch-level drift within SDK 55
   (`expo` 55.0.23 vs ~55.0.31 etc). Pre-existing. An 18-package bump is its
   own slice, not a drive-by.

---

### SESSION 2026-09-19 (part 1) — Memory system + full codebase audit

**What was built**
- `/docs/tallyshot-memory/` created with all 6 files.
- `ARCHITECTURE.md` filled in from the shipped code rather than left blank —
  the lookup waterfall, cache strategy, scanner library and AI model choices
  were already decided and running, so the "fill in after Checkpoint 2" blanks
  were answered from source.
- `BUGS.md` populated with 15 bugs from the audit (BUG-001 … BUG-015).

**What was changed**
- No application code touched. Audit only, as agreed.

**Decisions made**
- No re-scaffolding: CHANGES.md exists and documents 12 shipped slices.
- The audit reports the codebase as found, which is substantially more built
  than the brief assumed. Most of Phase 2, Phase 3 and Phase 5 in TODO.md
  already ships. TODO.md has been reconciled against reality rather than left
  as a greenfield plan.

**Key finding**
The scanner is not broken in the way the brief assumed. The *free database
chain* — the bulk of the barcode scanner — works. What is dead is every **AI**
path, for two independent reasons: no `.env` file, so `EXPO_PUBLIC_WORKER_URL`
falls back to a placeholder hostname in Expo Go (BUG-001); and the Anthropic
key behind the Worker has no credit (BUG-002). Receipt scanning is AI-only, so
receipt scanning is entirely down.

**Blockers — need Reece's decision**
1. **Brand palette conflict.** The brief says dark-first, `#00C896` teal, never
   orange. The app ships Indigo `#818cf8` + Amber `#f59e0b`, light and dark.
   `#00C896` is in zero files. Cannot start Phase 4 without knowing which wins.
2. **`.env`** — needs creating locally with the real Worker URL. Requires no
   decision, just doing, but it is a local file so it must be done on this
   machine.
3. **Anthropic billing** — top up, or every AI feature stays down.
4. **Root `TODO.md` vs memory `TODO.md`** — two lists now exist. Recommend the
   memory one becomes master and the root one is folded into it.
5. **Model ID in the brief** — `claude-sonnet-4-6` does not exist. The Worker
   actually runs `claude-opus-5` / `claude-haiku-4-5`. Recorded as-is in
   PROJECT.md/APIS.md per the brief, corrected in ARCHITECTURE.md.

---

## NEXT SESSION START HERE

Three slices landed on 2026-09-19: **13 of 15 audited bugs fixed**, the
unblocked Phase 3/4 card work, and **Phase 6 compare mode**. `tsc` clean,
Android bundle clean. Two EAS preview APKs built — `593e6674` is the current
one (`8e099610` predates compare mode).

**Nothing has been tested on a real device yet.** That is the first job.

What to check on the Samsung:
1. Barcode scan — the new lock-on: brackets walk inward, amber→green, one
   white flash, "Hold still…" mid-lock.
2. Scan something with certifications (Alpro, Yeo Valley, a Fairtrade bar) —
   the badge row, and the `*` footnote on derived badges.
3. Scan something with allergens (Nutella) — amber pills, not a sentence.
4. A beer or wine — ABV, UK units, and the new kcal-from-alcohol line.
5. Airplane mode, then scan — must say "Can't reach the databases", NOT
   "not in any database".
6. Scan history — skeleton rows on open, pull to refresh.
7. Deny the camera twice, reopen the scanner — Open Settings + "Type a barcode
   instead".
8. `/manual-barcode` — type `5000159407236`; then a deliberate typo, which the
   checksum should catch before any network call.
9. **Compare mode** — scan two products, open scan history, tap the scales
   icon, pick both. Check an incomparable pair too (a cosmetic vs a food) —
   should give a short honest screen, not a grid of dashes.
10. Receipt scan will still fail — that is BUG-002 (billing), not a regression.
    **Verified 2026-09-19:** the worker's request shape is correct against the
    current API; `detect` (haiku, temperature, no effort) and `lookup` (opus 5,
    effort, fallbacks beta) both return 400 identically, which a shape bug
    could not do. It is the account credit balance, which returns 400 not 402.

Then, in order:
- **Get the palette decision.** Gates BUG-011 and the rest of Phase 4.
- **Top up Anthropic billing**, then re-test every AI path.
- Confirm targetSdk 36 reached the manifest in the EAS build.
- Remaining unblocked work: full-width image hero, collapsible ingredients,
  branded share card, Phase 5 grid view + swipe-right-to-log, Phase 6 compare
  mode, Sentry, per-serving nutrition, E-number explanations, the remaining
  accessibility labels, and the 18-package patch-drift bump.
