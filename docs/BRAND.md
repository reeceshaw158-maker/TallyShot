# TallyShot — Brand Style Guide

> **Direction: Modern Fintech Minimal**
> Clean, high-contrast, trustworthy. Indigo sets TallyShot apart in a
> category dominated by green and orange competitors.

---

## Colour Palette

### Primary

| Token | Hex | RGB | Use |
|---|---|---|---|
| `accent` | `#6366f1` | 99, 102, 241 | Buttons, active states, highlights |
| `accentDeep` | `#4f46e5` | 79, 70, 229 | Icon lines, pressed states, borders |
| `bg` | `#110e38` | 17, 14, 56 | App/icon background, splash screen |

### Neutral (dark theme)

| Token | Hex | Use |
|---|---|---|
| `surface` | `#1a1744` | Cards, input backgrounds |
| `border` | `#2d2a6e` | Dividers, card borders |
| `textPrimary` | `#ffffff` | Headings, primary text |
| `textMuted` | `#a5b4fc` | Secondary text, labels |
| `textSubtle` | `#6366f1` | Placeholders, hints |

### Semantic

| Token | Hex | Use |
|---|---|---|
| `success` | `#34d399` | Saved, confirmed, deductible |
| `warning` | `#fbbf24` | Needs review, caution |
| `danger` | `#f87171` | Delete, error states |

---

## Typography

**Font family: Inter** (loaded via `expo-google-fonts`)

| Role | Weight | Size | Usage |
|---|---|---|---|
| Display | 800 ExtraBold | 32–36px | Hero numbers, amounts |
| Title | 700 Bold | 18–26px | Screen titles, card headings |
| Subtitle | 600 SemiBold | 14–16px | Section labels, merchant names |
| Body | 500 Medium | 13–15px | General text, list items |
| Caption | 400 Regular | 11–12px | Timestamps, metadata |

**Letter spacing:**
- Display: `−1` to `−0.6`
- Title: `−0.3` to `−0.2`
- Body: `0` (default)
- Caps labels: `+0.8` (e.g. "THIS MONTH")

---

## Spacing

Uses an **8pt base grid**.

| Token | Value | Use |
|---|---|---|
| `xs` | 4px | Icon gaps, tight padding |
| `sm` | 8px | List item inner padding |
| `md` | 12–16px | Card padding |
| `lg` | 20–24px | Screen horizontal padding |
| `xl` | 32–40px | Section gaps |

---

## Shape / Radius

| Component | Radius |
|---|---|
| Full pill (buttons, chips) | `100px` |
| Large cards | `16–20px` |
| Input fields | `10–14px` |
| Small badges | `8–10px` |
| Brand mark / icon bg | `18px` |

---

## Icon

| File | Size | Use |
|---|---|---|
| `assets/icon.png` | 1024×1024 | Play Store listing, iOS App Store |
| `assets/adaptive-icon.png` | 1024×1024 | Android home screen (transparent fg) |
| `assets/splash-icon.png` | 400×400 | Splash screen (centred on `#110e38`) |
| `assets/favicon.png` | 32×32 | Browser / PWA |

**Adaptive icon background:** `#110e38`
**Splash background:** `#110e38`

To regenerate all assets after any colour change:
```
python scripts/gen_assets.py
```

---

## Logo concept

A white receipt card on a deep indigo background.
- Three **decreasing-width indigo lines** represent extracted text/data
- A **camera-lens badge** (indigo circle, white pupil) sits at the bottom-right,
  overlapping the receipt — communicating "scan to capture"
- A **radial glow** behind the receipt adds depth without decoration

**Do not:**
- Add drop shadows to the icon
- Use the logo on backgrounds lighter than `#4f46e5`
- Add rounded corners to `icon.png` — Play Store adds its own

---

## Voice & tone

- **Clear over clever** — "Scan complete" not "Your receipt has been successfully processed"
- **Reassuring** — always tell users their photo is safe when something goes wrong
- **No jargon** — "Tax deductible" not "Deductible expense line item"
