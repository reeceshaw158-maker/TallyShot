# TallyShot — Release runbook

The single page that tells you exactly what to do, in what order, to ship to
the Google Play Store.

---

## Documents in `docs/`

- **`competitive-research.md`** — what Expensify, Easy Expense, Crunchr, Saldo do, where they fail, and our differentiators
- **`privacy-policy.md`** — host this at a public URL; required by Play Console
- **`play-data-safety.md`** — fill-in script for the Play Console Data Safety form
- **`play-store-listing.md`** — title, descriptions, "What's new", category, tags
- **`play-store-assets.md`** — icon, feature graphic, screenshot specs and what to capture
- **`pre-launch-checklist.md`** — manual test plan to run before publishing

---

## Step-by-step release flow

### Stage 1 — One-off setup (do once)

1. **Create an Expo account** at [expo.dev](https://expo.dev) if you don't have one
2. **Create a Google Play Developer account** at [play.google.com/console](https://play.google.com/console) — £20 one-time fee
3. **Buy a domain** (e.g. `tallyshot.app`) — needed for the privacy policy URL and the developer email
4. **Set up email** at that domain (`hello@`, `privacy@`) — Google Workspace, Fastmail, or any email host
5. **Deploy the Cloudflare Worker** (see Stage 2)
6. **Host the privacy policy** at `https://tallyshot.app/privacy`
   - Easiest: GitHub Pages with a one-page Markdown render, or Cloudflare Pages, or a one-page Vercel deploy. Free.

### Stage 2 — Deploy the Cloudflare Worker

This unlocks AI extraction. Without it, every scan returns 404 and the app falls through to manual entry.

```bash
# 1. Sign up for Cloudflare (free)
# 2. Install wrangler globally
npm install -g wrangler

# 3. From the project root
cd "C:\Users\reece\App 1\TallyShot\worker"

# 4. Initialise
npm init -y
npm install --save-dev typescript @cloudflare/workers-types

# 5. Log in to Cloudflare
wrangler login

# 6. Set your Anthropic API key as a secret (you'll be prompted to paste it)
wrangler secret put ANTHROPIC_API_KEY

# 7. Deploy
wrangler deploy

# Output will include something like:
#   Published tallyshot-proxy
#     https://tallyshot-proxy.<your-subdomain>.workers.dev
```

Then update `eas.json` and `.env`:

```bash
# .env
EXPO_PUBLIC_WORKER_URL=https://tallyshot-proxy.<your-subdomain>.workers.dev
```

And in `eas.json`, replace the placeholder URL in **all three profiles**.

### Stage 3 — Replace placeholder assets

1. Design icon and feature graphic per `play-store-assets.md`
2. Save icon as `assets/icon.png` and `assets/adaptive-icon.png` (1024×1024)
3. Save splash as `assets/splash-icon.png` (1024×1024 with transparency)

### Stage 4 — Configure EAS

```bash
# Install eas-cli
npm install -g eas-cli

# Log in
eas login

# Link the project (creates the EAS project ID and writes it to app.json)
eas init

# Configure update channels for OTA
eas update:configure
```

After `eas init`, your `app.json` will get `extra.eas.projectId` automatically. Don't change it.

### Stage 5 — Build the production AAB

```bash
# This builds in EAS cloud, ~10 minutes
eas build --platform android --profile production
```

When it finishes, you'll get a `.aab` download link. Download it.

### Stage 6 — Pre-launch testing

1. Run through every section of `pre-launch-checklist.md` on **your real phone**
2. Anything that fails — fix, rebuild, re-test
3. Don't skip the low-end Android section even if you don't own one — use the API 29 emulator

### Stage 7 — Play Console submission

1. Play Console → Create app
   - **Default language:** English (United Kingdom) or whatever fits
   - **App name:** TallyShot — Receipt Scanner
   - **App or game:** App
   - **Free or paid:** Free
   - Tick all the declarations
2. **App content** sidebar (this is where Play Console wants the long form):
   - **Privacy policy** — paste the URL from Stage 1.6
   - **App access** — "All functionality is available without restrictions" (we have no login wall)
   - **Ads** — "No, my app does not contain ads"
   - **Content rating** — fill out the questionnaire (see `play-store-listing.md` Content rating section)
   - **Target audience** — Adults (18+); "No" to children
   - **Data safety** — fill in using `play-data-safety.md`
   - **News app** — No
   - **COVID-19 contact tracing** — No
   - **Government app** — No
   - **Financial features** — Yes, "Personal finance management" → no other categories tick
3. **Main store listing** sidebar:
   - **App name** — TallyShot — Receipt Scanner
   - **Short description** — copy from `play-store-listing.md`
   - **Full description** — copy from `play-store-listing.md`
   - **App icon** — upload your 512×512
   - **Feature graphic** — upload your 1024×500
   - **Phone screenshots** — upload 6 from `play-store-assets.md`
   - **App category** — Finance
   - **Tags** — receipt scanner, expense tracker, tax tracker, bookkeeping
   - **Contact email** — `hello@tallyshot.app`
   - **Website** — `https://tallyshot.app`
4. **Production** sidebar (the actual release):
   - **Country availability** — start with UK, AU, NZ, IE, CA, US (the regions our tax presets cover)
   - **Releases** → New release
   - **Upload App Bundle** — drag in your `.aab` from Stage 5
   - **Release name** — `1.0.0`
   - **Release notes** — copy from `play-store-listing.md` "What's new"
   - **Save** then **Review release**
   - You will get warnings — read them. Fix any blockers before clicking **Start rollout to production**.
5. **Review time** — Google reviews in 1–7 days for a first release. Plan accordingly.

### Stage 8 — Post-launch

- Watch the **Play Console dashboard** for crash reports for the first 72 hours
- If a crash spike appears — push an OTA update via `eas update --branch production` (no Play Console review needed for JS-only changes)
- Reply to every review for the first month — this materially improves your rating

---

## Quick reference: build commands

```bash
# Run locally (Expo Go)
npx expo start --clear

# Run on Android emulator
npx expo start --clear   # then press 'a'

# Type-check
npx tsc --noEmit

# Bundle export check (catches Metro / dependency issues)
npx expo export --platform android

# Production build (cloud)
eas build --platform android --profile production

# OTA update (after build is in users' hands)
eas update --branch production --message "Fix description here"
```

---

## What's still not done

These are deliberate v1 choices to keep the launch tight:

- **No RevenueCat** — Pro tier exists in the UI (`isPro` flag) but there's no paywall; flag is hardcoded `true` for now
- **No cloud sync** — local-only by design (and biggest competitive differentiator)
- **No bank-feed integration** — flagged for v1.5+ (TrueLayer over a custom dev client)
- **No teams** — flagged for v1.5
- **No web app** — flagged for v2

When you're ready to build any of these, see `competitive-research.md` for the lessons that should inform the work.
