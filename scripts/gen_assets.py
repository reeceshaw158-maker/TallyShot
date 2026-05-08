"""
TallyShot asset generator v2 — Modern Fintech Minimal
======================================================
Generates:
  assets/icon.png            1024x1024  full icon (solid bg)
  assets/adaptive-icon.png   1024x1024  transparent bg (Android composites bg behind it)
  assets/splash-icon.png      400x400   logo centred for splash screen
  assets/favicon.png          32x32     browser favicon

Run:  python scripts/gen_assets.py
"""

from PIL import Image, ImageDraw
import os

# ── Brand palette ──────────────────────────────────────────────────────────
# Primary accent — the blue-violet that makes TallyShot stand out
INDIGO        = (99, 102, 241)    # #6366f1  vibrant indigo
INDIGO_DEEP   = (79, 70, 229)     # #4f46e5  slightly deeper, used for lines
INDIGO_BG     = (17, 14, 56)      # #110e38  near-black indigo bg
WHITE         = (255, 255, 255)
TRANSPARENT   = (0, 0, 0, 0)

os.makedirs("assets", exist_ok=True)
os.makedirs("assets/_old", exist_ok=True)


# ── Helpers ────────────────────────────────────────────────────────────────

def rounded_rect(draw, x0, y0, x1, y1, r, fill):
    """Filled rounded rectangle."""
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    for cx, cy in [(x0, y0), (x1 - 2*r, y0), (x0, y1 - 2*r), (x1 - 2*r, y1 - 2*r)]:
        draw.ellipse([cx, cy, cx + 2*r, cy + 2*r], fill=fill)


def draw_background(img, size):
    """Deep indigo background with a subtle radial glow."""
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, size, size], fill=INDIGO_BG)
    cx = cy = size // 2
    # Soft radial glow — layer semi-transparent indigo ellipses
    for r in range(int(size * 0.45), 0, -int(size * 0.008)):
        alpha = int(55 * (1 - r / (size * 0.45)))
        overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        odraw = ImageDraw.Draw(overlay)
        odraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*INDIGO, alpha))
        img.alpha_composite(overlay)


def draw_logo(img, cx, cy, s=1.0, on_dark=True):
    """
    Draw the TallyShot receipt logo centred at (cx, cy).
    s   — scale factor (1.0 = sized for 1024px canvas)
    on_dark — True when bg is dark (use white receipt); False for transparent bg
    """
    draw = ImageDraw.Draw(img)

    # ── Receipt body ──
    rw = int(340 * s)       # receipt width
    rh = int(440 * s)       # receipt height
    rr = int(32 * s)        # corner radius

    # Shift receipt slightly UP so the badge (bottom-right) is visually centred
    offset_y = int(28 * s)
    rx0 = cx - rw // 2
    ry0 = cy - rh // 2 - offset_y
    rx1 = rx0 + rw
    ry1 = ry0 + rh

    card_color = WHITE if on_dark else WHITE
    rounded_rect(draw, rx0, ry0, rx1, ry1, rr, card_color)

    # ── Three scan lines inside receipt ──
    lx0 = rx0 + int(40 * s)
    lh  = int(15 * s)

    for frac, width_frac in [(0.30, 0.80), (0.47, 0.63), (0.64, 0.47)]:
        ly  = ry0 + int(frac * rh)
        lw  = int(width_frac * (rw - 80 * s))
        draw.rounded_rectangle(
            [lx0, ly, lx0 + lw, ly + lh],
            radius=lh // 2,
            fill=INDIGO_DEEP,
        )

    # ── Camera-lens badge (overlaps bottom-right corner of receipt) ──
    br   = int(52 * s)    # badge radius
    bcx  = rx1 - int(10 * s)   # badge centre x — overlaps right edge of receipt
    bcy  = ry1 + int(42 * s)   # badge centre y — sits just below receipt

    # Background halo (matches icon bg) to visually "lift" badge off receipt
    halo_r = br + int(7 * s)
    halo_color = (*INDIGO_BG, 255) if on_dark else TRANSPARENT
    if on_dark:
        draw.ellipse(
            [bcx - halo_r, bcy - halo_r, bcx + halo_r, bcy + halo_r],
            fill=halo_color,
        )

    # Badge circle
    draw.ellipse(
        [bcx - br, bcy - br, bcx + br, bcy + br],
        fill=INDIGO,
    )

    # Inner white dot (lens pupil)
    pr = int(20 * s)
    draw.ellipse(
        [bcx - pr, bcy - pr, bcx + pr, bcy + pr],
        fill=WHITE,
    )

    # Tiny indigo dot in centre of pupil
    cr = int(7 * s)
    draw.ellipse(
        [bcx - cr, bcy - cr, bcx + cr, bcy + cr],
        fill=INDIGO,
    )


# ══════════════════════════════════════════════════════════════════════════
# 1. icon.png — 1024x1024, full solid icon
# ══════════════════════════════════════════════════════════════════════════
SIZE = 1024
img_icon = Image.new("RGBA", (SIZE, SIZE), TRANSPARENT)
draw_background(img_icon, SIZE)
draw_logo(img_icon, SIZE // 2, SIZE // 2, s=1.0, on_dark=True)

final_icon = Image.new("RGB", (SIZE, SIZE), INDIGO_BG)
final_icon.paste(img_icon, mask=img_icon.split()[3])
final_icon.save("assets/icon.png", "PNG", optimize=True)
print("OK  assets/icon.png")


# ══════════════════════════════════════════════════════════════════════════
# 2. adaptive-icon.png — 1024x1024, TRANSPARENT background
#    Android composites #110e38 behind this layer.
#    Keep logo within the inner 72% safe zone.
# ══════════════════════════════════════════════════════════════════════════
img_adaptive = Image.new("RGBA", (SIZE, SIZE), TRANSPARENT)
draw_logo(img_adaptive, SIZE // 2, SIZE // 2, s=0.90, on_dark=False)
img_adaptive.save("assets/adaptive-icon.png", "PNG", optimize=True)
print("OK  assets/adaptive-icon.png")


# ══════════════════════════════════════════════════════════════════════════
# 3. splash-icon.png — 400x400 transparent logo
#    Expo centres this on splash.backgroundColor = #110e38
# ══════════════════════════════════════════════════════════════════════════
SP = 400
img_splash = Image.new("RGBA", (SP, SP), TRANSPARENT)
draw_logo(img_splash, SP // 2, SP // 2, s=0.36, on_dark=False)
img_splash.save("assets/splash-icon.png", "PNG", optimize=True)
print("OK  assets/splash-icon.png")


# ══════════════════════════════════════════════════════════════════════════
# 4. favicon.png — 32x32 (used in web/PWA context)
# ══════════════════════════════════════════════════════════════════════════
FV = 64   # generate at 2x then downsample for quality
img_fav = Image.new("RGBA", (FV, FV), TRANSPARENT)
draw = ImageDraw.Draw(img_fav)
# Simple: solid indigo square with receipt lines
draw.rectangle([0, 0, FV, FV], fill=INDIGO_BG)
rw2, rh2, rr2 = int(FV*0.52), int(FV*0.64), int(FV*0.08)
rx0 = (FV - rw2) // 2
ry0 = (FV - rh2) // 2 - 2
rounded_rect(draw, rx0, ry0, rx0+rw2, ry0+rh2, rr2, WHITE)
lx = rx0 + int(FV*0.06)
for frac, wf in [(0.28, 0.75), (0.46, 0.58), (0.64, 0.42)]:
    ly = ry0 + int(frac * rh2)
    draw.rectangle([lx, ly, lx + int(wf*(rw2-FV*0.12)), ly + int(FV*0.07)], fill=INDIGO_DEEP)
img_fav_small = img_fav.resize((32, 32), Image.LANCZOS)
img_fav_small.save("assets/favicon.png", "PNG", optimize=True)
print("OK  assets/favicon.png")


print("\nAll assets generated.")
