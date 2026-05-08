"""
TallyShot asset generator
Produces:
  assets/icon.png           1024x1024  full icon (indigo bg + white receipt)
  assets/adaptive-icon.png  1024x1024  foreground only (transparent bg)
  assets/splash-icon.png     400x400   centred logo for splash screen
"""

from PIL import Image, ImageDraw
import math, os

# ── Brand colours ──────────────────────────────────────────────────────────
INDIGO      = (79, 70, 229)       # #4f46e5 — CTA / accent
INDIGO_DARK = (30, 27, 75)        # #1e1b4b — deep bg tint
BG_DARK     = (10, 10, 10)        # #0a0a0a — app background
WHITE       = (255, 255, 255)
WHITE_90    = (255, 255, 255, 230)
TRANSPARENT = (0, 0, 0, 0)

os.makedirs("assets", exist_ok=True)

# ── Helper: rounded rectangle ──────────────────────────────────────────────
def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + radius*2, y0 + radius*2], fill=fill)
    draw.ellipse([x1 - radius*2, y0, x1, y0 + radius*2], fill=fill)
    draw.ellipse([x0, y1 - radius*2, x0 + radius*2, y1], fill=fill)
    draw.ellipse([x1 - radius*2, y1 - radius*2, x1, y1], fill=fill)

# ── Draw the logo onto any canvas ─────────────────────────────────────────
def draw_logo(img, cx, cy, size, color=WHITE):
    """
    Draws the TallyShot logo centred at (cx, cy).
    The logo is a receipt shape with three scan lines and a small
    camera-lens circle in the bottom-right corner.
    `size` controls overall scale (base = 1.0 → fits a 1024px icon nicely).
    """
    draw = ImageDraw.Draw(img)
    s = size   # scale factor

    # --- Receipt body (rounded rectangle, slightly tilted via polygon) ---
    rw = int(260 * s)   # receipt width
    rh = int(340 * s)   # receipt height
    rr = int(28 * s)    # corner radius
    rx0 = cx - rw // 2
    ry0 = cy - rh // 2
    rx1 = rx0 + rw
    ry1 = ry0 + rh

    # White receipt card
    rounded_rect(draw, (rx0, ry0, rx1, ry1), rr, color)

    # --- Scan lines (indigo on white receipt) ---
    lx0 = rx0 + int(36 * s)
    lx1 = rx1 - int(36 * s)
    line_color = INDIGO if color == WHITE else (255,255,255,180)
    line_h = int(14 * s)
    gap   = int(22 * s)

    for i, frac in enumerate([0.30, 0.48, 0.66]):
        ly = ry0 + int(frac * rh)
        lw = int((0.9 - i * 0.18) * (lx1 - lx0))   # lines get shorter
        draw.rounded_rectangle(
            [lx0, ly, lx0 + lw, ly + line_h],
            radius=line_h // 2,
            fill=line_color,
        )

    # --- Camera lens circle (bottom-right of receipt) ---
    lens_r = int(38 * s)
    lens_cx = rx1 - int(54 * s)
    lens_cy = ry1 - int(54 * s)

    # Outer ring
    draw.ellipse(
        [lens_cx - lens_r, lens_cy - lens_r, lens_cx + lens_r, lens_cy + lens_r],
        fill=INDIGO if color == WHITE else (255,255,255,200),
    )
    # Inner dot
    inner_r = int(18 * s)
    draw.ellipse(
        [lens_cx - inner_r, lens_cy - inner_r, lens_cx + inner_r, lens_cy + inner_r],
        fill=color,
    )

# ══════════════════════════════════════════════════════════════════════════
# 1. icon.png  —  1024x1024, indigo background + white logo
# ══════════════════════════════════════════════════════════════════════════
SIZE = 1024
img_icon = Image.new("RGBA", (SIZE, SIZE), TRANSPARENT)
draw = ImageDraw.Draw(img_icon)

# Deep indigo background (full bleed — Play Store adds its own rounding)
draw.rectangle([0, 0, SIZE, SIZE], fill=INDIGO_DARK)

# Subtle radial glow in the centre
cx, cy = SIZE // 2, SIZE // 2
for r in range(420, 0, -4):
    alpha = int(60 * (1 - r / 420))
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(*INDIGO, alpha))

draw_logo(img_icon, cx, cy, size=1.0)

# Convert to RGB for icon.png (no transparency needed, bg is solid)
final_icon = Image.new("RGB", (SIZE, SIZE), INDIGO_DARK)
final_icon.paste(img_icon, mask=img_icon.split()[3])
final_icon.save("assets/icon.png", "PNG", optimize=True)
print("OK assets/icon.png")

# ══════════════════════════════════════════════════════════════════════════
# 2. adaptive-icon.png  —  1024x1024, TRANSPARENT background
#    Android puts its own coloured background behind this layer.
#    Keep the logo centred and within the inner 66% safe zone.
# ══════════════════════════════════════════════════════════════════════════
img_adaptive = Image.new("RGBA", (SIZE, SIZE), TRANSPARENT)
draw_logo(img_adaptive, cx, cy, size=0.88)
img_adaptive.save("assets/adaptive-icon.png", "PNG", optimize=True)
print("OK assets/adaptive-icon.png")

# ══════════════════════════════════════════════════════════════════════════
# 3. splash-icon.png  —  400x400 centred on dark bg (#0a0a0a)
#    Expo renders this image on top of splash.backgroundColor.
# ══════════════════════════════════════════════════════════════════════════
SP = 400
img_splash = Image.new("RGBA", (SP, SP), TRANSPARENT)
draw_logo(img_splash, SP // 2, SP // 2, size=0.38)
img_splash.save("assets/splash-icon.png", "PNG", optimize=True)
print("OK assets/splash-icon.png")

print("\nDone! All assets generated.")
