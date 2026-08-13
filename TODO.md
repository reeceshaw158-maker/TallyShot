# TallyShot — To Do

## 🔴 Blocking — scanner fix (2026-07-31)

- [x] **Deploy the Cloudflare Worker.** Root cause #1 of "scanner doesn't
      scan anything": `worker/src/index.ts` had been rewritten locally (mode
      dispatch, barcode `lookup`, live `detect`, structured JSON output) but
      was never deployed — the live Worker was still running old
      single-purpose `extract`-only code that rejected barcode lookups and
      the live detect loop outright. **Deployed** — live Worker now matches
      the app's requests (verified: unknown modes are now rejected correctly
      instead of the old blanket "Missing required fields").
- [x] **Add Anthropic API credits.** Root cause #2, found after the deploy:
      every real AI call (extract/detect/lookup) was reaching Claude
      successfully but being rejected with "Your credit balance is too low".
      Billing has been fixed on the Anthropic account. Verified via direct
      test calls: `lookup` (barcode → product) and `detect` (find receipt in
      frame) both now return real, correct results.
- [x] Typecheck + Metro bundle verified clean (`tsc --noEmit` zero errors,
      1685 modules bundled with no build errors) after the Settings and
      Worker changes.
- [ ] Test on a real device to confirm the full in-app flow feels right:
      receipt capture, the live AI-assist lock-on box, and barcode
      "Identify with AI" from the actual camera screen (server-side is
      confirmed working; this is just the on-device UX pass).
- [ ] **Rotate the Anthropic API key** that was pasted into this chat
      earlier — it should be treated as compromised regardless of billing
      status. Update the Worker secret afterwards with
      `npx wrangler secret put ANTHROPIC_API_KEY` from `worker/`.
- [x] Commit `worker/src/index.ts` + `worker/wrangler.toml` — committed
      2026-08-13 along with the barcode lookup chain (Slice 11).

## 🟡 Subscription / pricing

- [x] Added a visible "Upgrade to Pro" row with pricing (£3.99/mo ·
      £24.99/yr) to Settings → Free plan card, linking to `/paywall`
      (previously only reachable after hitting the monthly scan limit).
- [ ] Confirm RevenueCat offerings are configured (`EXPO_PUBLIC_REVENUECAT_KEY`)
      so `/paywall` shows live store prices instead of the £3.99/£24.99
      fallback strings.
- [ ] Decide whether the pricing row should also show on the onboarding
      flow, given `app/onboarding/index.tsx` currently advertises "no
      paywall pop-ups" — make sure the messaging still feels honest.

## 🟢 Nice to have / follow-up

- [ ] Add a lightweight monitoring/alert (e.g. Cloudflare Worker error rate)
      so a future Worker/client mismatch is caught immediately instead of
      silently degrading (the detect loop swallows errors on purpose, which
      is correct UX but makes backend breakage invisible).
- [ ] Consider a version/compat check: have the client send a version or
      capability flag and have the Worker reject clearly instead of
      returning ambiguous errors, so a stale-deploy mismatch fails loudly in
      testing rather than as "scanning doesn't work."
