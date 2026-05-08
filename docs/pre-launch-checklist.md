# Pre-launch test checklist — TallyShot

Run through every item below on a real Android device before pushing the
production build to Play Console. Don't trust the emulator for the final
pass — emulators hide camera bugs, network bugs, and storage-permission edge cases.

---

## Test devices

You need at least one of each:

- ✅ **Recent Pixel or similar (Android 14+, API 34)** — your daily driver works
- ✅ **Low-end / older device (Android 10–12, API 29–31)** — buy a £40 used Moto E or use Android Studio's emulator with a Pixel 4a + API 29

---

## A. Cold start + onboarding (~5 min)

- [ ] App icon renders correctly on the home screen (amber + white receipt, not the default Expo blob)
- [ ] First launch shows splash (`#0a0a0a` bg) for under 2 seconds, no white flash
- [ ] Welcome step displays brand mark + tagline + 4-feature grid
- [ ] Skip button works from step 2 onward; Back button works
- [ ] Region step: pick a region, confirm currency/tax label updates show
- [ ] Camera permission prompt actually asks; **denying** still lets you continue
- [ ] After "Start scanning", lands on Receipts list with empty state

## B. Empty state and first scan (~5 min)

- [ ] Empty state shows "No receipts yet" with Scan CTA
- [ ] Tap Scan → camera opens within 2s; shutter button works
- [ ] Take a real photo of a real receipt
- [ ] Processing screen shows the photo + "Reading receipt..." pill
- [ ] If Worker is deployed: extraction returns within 10s, lands on Review
- [ ] If Worker is not deployed: error state shows with Edit / Retry / Cancel
- [ ] **Tap Cancel from error state** → photo is preserved as needs_review (this is the key "never lose a receipt" promise — verify by going back to list and seeing the yellow card)

## C. Manual entry path (~3 min)

- [ ] On Capture screen, tap "Add manually" — opens Review with empty fields
- [ ] Fill merchant, total, date, save
- [ ] Receipt appears in list with correct icon/category
- [ ] Tap into it — detail screen renders without errors

## D. Receipt detail + edit (~5 min)

- [ ] Hero image shows tappable badge ("Tap photo to edit")
- [ ] Pencil icons visible on the hero card and every detail row
- [ ] Tap "Edit" — Review screen opens with all values populated
- [ ] Add 2 line items, change qty/unit price — line total recalculates
- [ ] Save — changes persist, stats update
- [ ] Delete a receipt — image file is gone (verify with file manager if you have one) and row is gone

## E. Region + tax behaviour (~5 min)

- [ ] Settings → Region: pick UK 🇬🇧 → Currency = GBP, Tax label = "VAT"
- [ ] Add a manual receipt — Review form shows "VAT (incl.)" label
- [ ] Settings → Region: pick US 🇺🇸 → Currency = USD, Tax label = "Sales tax"
- [ ] Add a manual receipt — Review form shows "Sales tax" without "(incl.)"
- [ ] Settings → Tax mode: override to opposite mode → label updates immediately
- [ ] Reset to original region; confirm currency reverts

## F. Filters + search (~3 min)

- [ ] Filter chip "Tax deductible" appears; tapping it shows only deductible receipts
- [ ] Add a needs_review receipt; confirm "Needs review (1)" chip appears with yellow tint
- [ ] Search by merchant name; clear button works

## G. Stats screen (~3 min)

- [ ] "This month" shows correct total
- [ ] "Last month" toggle switches data correctly
- [ ] If deductible receipts exist, green deductible card appears
- [ ] Category bars show in teal accent, sorted by total descending
- [ ] Top merchants list shows up to 5

## H. Export (~5 min)

- [ ] Settings → Export receipts — opens Export screen
- [ ] Date range pills work; "Custom" reveals from/to inputs
- [ ] Format toggle PDF/CSV works
- [ ] Template picker (PDF only) shows 3 options with accent border on selected
- [ ] Custom title and notes fields accept input
- [ ] **PDF Generate Preview** → preview screen opens
  - On Android: shows fallback card (expected — Android WebView limitation)
  - Tap Share → system share sheet appears with PDF
- [ ] **CSV Export & Share** → share sheet appears with `.csv` file
- [ ] Open the CSV in any spreadsheet app — verify all columns populate, Line Items column has the formatted string

## I. Settings + privacy (~3 min)

- [ ] All toggles work: Quick Scan on/off, theme switch (system/dark/light)
- [ ] Light mode actually changes the entire UI (not just Settings)
- [ ] Privacy section shows all 4 lines with accent icons
- [ ] **"Delete all data"** with two-step confirm — verify everything is wiped

## J. Network failure + offline (~5 min)

- [ ] Turn off WiFi + mobile data
- [ ] Open the app — list, search, manual entry, edit, delete, export all still work
- [ ] Tap Scan → take photo → processing fails gracefully → "Edit details" saves a needs_review receipt with the photo
- [ ] Re-enable network, open the needs_review receipt, tap Retry AI → succeeds (if Worker is deployed)

## K. Permission denial paths (~3 min)

- [ ] Settings (Android) → Apps → TallyShot → Permissions → Camera = Deny
- [ ] Open TallyShot → tap Scan → permission UI shows with "Allow Camera" + "Choose from Gallery"
- [ ] "Choose from Gallery" still works without camera permission

## L. Backup + restore (~5 min — optional, recommended)

- [ ] Take 3+ scans
- [ ] Settings → Export receipts → CSV → Save the CSV to Drive/Files
- [ ] Settings → Delete all data
- [ ] Verify list is empty
- [ ] (No in-app restore yet — this just confirms CSV is the user's lifeline)

## M. Performance on low-end (~5 min)

On the API 29 device or emulator:

- [ ] Cold start under 4s
- [ ] Scrolling Receipts list with 50+ entries is smooth (no stutter)
- [ ] Camera opens within 2s of tapping Scan
- [ ] Stats screen renders within 1s when switching periods
- [ ] No "Application not responding" dialogs

## N. Crash test (~2 min)

- [ ] Background the app on the Receipts list, kill it from Recents, reopen — comes back to Receipts list (or onboarding if never completed)
- [ ] Background during a scan in progress — when reopened, no zombie state
- [ ] Lock screen during processing — when unlocked, app continues correctly

---

## Build checklist (before uploading the AAB)

- [ ] `app.json` `version` is the user-facing version (e.g. `1.0.0`)
- [ ] `eas.json` `production.autoIncrement: true` is set (so versionCode bumps automatically)
- [ ] `EXPO_PUBLIC_WORKER_URL` env var in `eas.json` production profile points to your **deployed** Worker URL
- [ ] All four `docs/` files reviewed: privacy policy, data safety, store listing, assets
- [ ] Icon, adaptive icon, and splash assets replaced with real designs (not the default blue Expo blob)
- [ ] `npx tsc --noEmit` passes
- [ ] `npx expo export --platform android` builds clean
- [ ] Production build runs through `eas build --platform android --profile production`
- [ ] AAB downloaded and tested via Play Console internal testing track BEFORE production release

---

## Release strategy

1. **Internal testing track** (Play Console → Testing → Internal testing) — push the first AAB here, add yourself + 2 friends as testers, run this checklist on real devices.
2. **Closed testing** (optional, with 20+ users) — run for a week, gather feedback.
3. **Production release** — only after 2 weeks of clean internal/closed testing.
