# TallyShot

**Snap a receipt. AI reads it. Done.**

TallyShot is an Android app that photographs receipts and automatically extracts the details — merchant, date, total, category — using AI. No manual typing. No lost receipts at tax time.

## Features

- **AI scanning** — photograph any receipt and have the details extracted in seconds
- **Expense tracking** — categorise receipts, mark tax-deductible items, track monthly totals
- **Export** — export receipts to CSV for your accountant or tax return
- **Quick Scan mode** — for confident extractions, skips review and saves instantly
- **Offline-first** — all data stored locally on your device, no account required

## Built with

- [Expo](https://expo.dev) / React Native
- [expo-router](https://expo.github.io/router) — file-based navigation
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) — local database
- [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera/) — receipt scanning
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- Claude AI (Anthropic) via Cloudflare Worker — receipt data extraction

## Privacy

Receipt photos are sent to an AI service to extract text, then discarded. All receipt data is stored locally on your device. No accounts. No tracking. No ads.

[Full privacy policy](https://reeceshaw158-maker.github.io/TallyShot/privacy-policy.html)

## Download

Coming soon to the Google Play Store.
