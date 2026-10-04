# TallyShot promo reel

A 15-second, 1080×1920 (9:16) promo for Instagram Reels and TikTok. It is one self-contained
`index.html` built with HTML, CSS, SVG and GSAP. There are no images: every graphic is drawn in code.

## Watch it

Open `index.html` in Chrome. It opens on the end frame with a play button.

- **Click play** to start. It loops forever, and the held end frame cuts to the hook on the downbeat.
- **Click the reel or press space** to pause. The button comes back as "Restart".
- **`index.html?autoplay`** starts straight away.
- **`index.html?t=7.2`** freezes on any moment, which is handy for picking a thumbnail.

The page needs internet for GSAP (cdnjs) and the fonts (Google Fonts: Inter Tight, JetBrains Mono).

## Timing (120 BPM, a hit every 0.5s)

| Time | Section | What happens |
|---|---|---|
| 0–1s | Hook | Receipt flies in, laser scan turns paper into parsed data. "Stop losing receipts." |
| 1–5s | Freelancers | Receipts land on the beat, running total counts up, pile sorts into a ledger, rows collapse into "Claim ready". "Snap it. Sort it. Claim it." |
| 5–10s | Groceries | Barcode draws itself, gets scanned, unfolds into a product card, explodes into ingredient and health tags. "Know what's in your basket." |
| 10–13s | Montage | Six hard cuts, one per beat: kinetic type (scan history), shape morph (allergen flags), split screen (compare), camera zoom (additives), camera pan (export), colour shift (currencies and tax presets). |
| 13–15s | End frame | Logo builds, "TallyShot", "Scan. Tally. Done.", "Get it on Google Play". Nothing moves from 14s to 15s. |

## Export to MP4

`render.js` does not screen-record. It seeks the timeline to each exact frame, screenshots it
and pipes the PNGs into ffmpeg, so there are no dropped frames and every render is identical.

```bash
cd marketing/promo-reel
npm install          # puppeteer (bundles Chrome) + ffmpeg-static (bundles ffmpeg)
npm run render       # -> tallyshot-reel.mp4, 1080x1920, 30fps, H.264, yuv420p
```

Other options:

```bash
node render.js --fps 60 --out reel-60fps.mp4   # 60fps version
node render.js --audio track.mp3               # add a 120 BPM track, trimmed to 15s
node render.js --crf 12                         # higher quality (bigger file)
node render.js --stills 0.9,4.6,14.5            # PNG stills only, e.g. for a cover image
```

Environment overrides:

- `CHROME_PATH` uses an installed Chrome instead of Puppeteer's bundled one.
- `FFMPEG_PATH` uses your own ffmpeg instead of the bundled one.

A full 30fps render took about 10 minutes on the machine this was built on. The blur effects make each frame expensive to paint.

### Adding music

Any 120 BPM track lines up if its first downbeat is at 0:00. Trim the track so the first beat is at
the very start, then pass it with `--audio`. The montage cuts land on 10.0, 10.5, 11.0, 11.5, 12.0 and 12.5s.

### Doing it by hand

If you prefer your own ffmpeg step, export stills and encode them yourself:

```bash
ffmpeg -framerate 30 -i frames/%04d.png -c:v libx264 -crf 16 -pix_fmt yuv420p -movflags +faststart out.mp4
```

## Posting notes

- **Safe zones.** Reels and TikTok cover roughly the bottom 400px and right 150px with UI. All key text sits above y≈1550.
- **Flashing.** Flashes are low-opacity and the colour shift is a smooth fade, so it stays within photosensitivity guidance.
- **Cover image.** Use `--stills 14.5` for the end frame, or `--stills 7.5` for the tag explosion.

## Customising

- **Accent colour.** Change `--accent` in the CSS and `ACCENT` in the script. It is teal `#00C896` from the project brief.
- **Currency.** Change `CUR` in the script. The receipt paper itself says £ in the HTML.
- **Copy and data.** Receipts are in `CARDS`, grocery tags in `TAGS`, allergen chips in `CHIPS`.
- **Timing.** Every beat is a literal time in `build()`, grouped by section with comments.

The node_modules folder here is git-ignored by the root `.gitignore`. If Metro ever complains about it
while running the app, delete `marketing/promo-reel/node_modules` after rendering.
