# Play Store assets — what to capture and at what specs

Google Play requires these visual assets. Specs are mandatory.

---

## Required assets

| Asset | Size (px) | Format | Notes |
|---|---|---|---|
| **App icon** | 512 × 512 | 32-bit PNG (with alpha) | Master icon Google uses on the listing. Different from the in-app icon. |
| **Feature graphic** | 1024 × 500 | PNG or JPG | Hero banner shown on the store listing. Don't put critical text near edges. |
| **Phone screenshots** | min 1080 × 1920 (or 1920 × 1080) | PNG or JPG | At least **2**, max **8**. Suggest **6**. |
| Tablet screenshots | optional (1200 × 1920+) | optional | Skip for v1 — we don't optimise for tablets |
| Promo video (YouTube) | optional | YouTube link | Skip for v1 |

---

## App icon — what to design

Replace `assets/icon.png` and `assets/adaptive-icon.png` with the same final design.

**Brief:**
- Background: solid amber `#f5a623`
- Foreground: white receipt glyph (Material Community Icons `receipt`-style)
- Square corners — Android handles the rounding via the adaptive mask
- Bold, scannable at 48px — no fine detail

**Suggested generation:**
- Use a free tool like Figma, Canva, or [Icon Kitchen](https://icon.kitchen/) — set background `#f5a623`, foreground a white receipt SVG
- Export at 1024 × 1024 PNG; downscale to 512 × 512 for the Play Store master, drop the same 1024 PNG into `assets/icon.png` and `assets/adaptive-icon.png`

**Adaptive icon foreground**: leave 25% padding around the receipt glyph so Android's circular/squircle mask doesn't crop it.

---

## Feature graphic — what to design (1024 × 500)

The brief is: tell someone in two seconds what TallyShot does and what makes it different.

**Suggested layout:**
- **Left half (50%)**: solid `#0a0a0a` background, large white Inter ExtraBold:
  ```
  Snap.
  Extract.
  Done.
  ```
  Below in amber (`#f5a623`): "10 free AI scans per month. Forever."
- **Right half (50%)**: a single phone mockup at slight angle showing the Receipts list (the dark UI with "THIS MONTH" header + amber Scan button + a couple of receipt cards)
- Avoid: placing the text in the bottom 100px (Play crops in some surfaces) or within 50px of the right edge

**Tools:** Figma (use Apple's free phone-frame template) or [BannerBear](https://bannerbear.com) / [Hotpot.ai App Banner Maker](https://hotpot.ai/design/app-banner). Do not use Lorem Ipsum.

---

## Phone screenshots — six to capture

**Spec:** 1080 × 1920 (portrait), PNG. Use a real device or an Android Studio Pixel 6/7 emulator at 1080×2400 — Play accepts any 9:16 ratio above 320px.

You don't have to add device frames or marketing copy to the screenshots themselves (Google adds a frame on small thumbnails) — but the top 4 competitors all do, and conversions are noticeably higher. Suggest framing screenshots 1, 3, 5 with one-line marketing copy at the top.

### What to capture, in order

| # | Screen | Device state to set up | Caption (overlaid) |
|---|---|---|---|
| **1** | **Receipts list** with the new header | Have **3–5 receipts saved** spanning at least 2 categories; have the monthly total card showing a real number (e.g. £247.30) | "Every receipt, organised in seconds" |
| **2** | **Receipt detail screen** (the showcase from Slice 3A) | Open a single receipt with **at least 3 line items**, tax-deductible toggled on | "AI extracts every line item. Edit anything." |
| **3** | **Capture/camera screen** | Open the camera; hold a real receipt in frame | "Snap a receipt. Done." |
| **4** | **Stats screen** | Make sure you have receipts in **at least 3 categories** + 1 deductible so the green deductible card appears | "See your spending, by category" |
| **5** | **Export screen** with the PDF Tax template selected | Pick This Month, PDF, Tax submission | "Export tax-ready reports" |
| **6** | **Settings → Region picker** OR the onboarding free-tier step | Region picker showing all 7 flags, OR the green-checkmark "What's free" step | "Honest free tier. No ads. No tracking." |

### How to take perfect screenshots

**On a real phone:**
1. Sideload a fresh build with `eas build --platform android --profile preview` (APK).
2. Install the APK on your phone.
3. Set up your device data per the table above.
4. Use Android's standard screenshot (Volume Down + Power) at the moments shown.
5. Pull the screenshots off the phone via USB or Google Photos.

**On the emulator:**
1. Start the Pixel 6 / API 34 emulator.
2. `adb install <preview-build>.apk`
3. Use the camera button on the emulator's right-hand toolbar — it saves a clean PNG to your computer.

---

## Pre-flight checks for assets

Before uploading any asset to the Play Console:

- [ ] Icon at 512×512, 32-bit PNG, file size under 1 MB
- [ ] Adaptive icon foreground has at least 25% padding from the edges
- [ ] Feature graphic exactly 1024×500
- [ ] Each screenshot at least 1080 in its long dimension, no metadata leaked (no test data, no real bank info, no real personal numbers)
- [ ] No competitor name in any image
- [ ] No Apple, iOS, or Apple device frames (Google rejects these on Android listings)
- [ ] No "Coming soon" claims
- [ ] No "FREE" written in the icon or feature graphic — Google flags this as a misleading claim and rejects
- [ ] Status bar (notch / time / battery) clean — set the device clock to 9:41, battery to 100%, network bars full
