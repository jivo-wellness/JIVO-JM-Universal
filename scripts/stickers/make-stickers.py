"""Draws JM's built-in sticker pack: original artwork from plain shapes and the Inter font (SIL OFL), JM colours.

Usage: python scripts/stickers/make-stickers.py node_modules/@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf assets/stickers
Each sticker: 512 x 512 transparent PNG with a white die-cut outline and a soft shadow.
"""

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 1024  # drawn at 2x, saved at 512
GREEN, DARK, LEAF, GOLD, RED, PINK, SKY, INK = "#22c55e", "#15803d", "#86efac", "#f0b429", "#ef4444", "#f472b6", "#38bdf8", "#14532d"
WHITE = "#ffffff"
FONT = sys.argv[1]
OUT = Path(sys.argv[2])


def font(size):
    return ImageFont.truetype(FONT, size)


def canvas():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def face(d, fill=GREEN, cx=512, cy=520, r=330):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)
    # soft top highlight
    d.ellipse((cx - r * 0.55, cy - r * 0.85, cx + r * 0.15, cy - r * 0.45), fill="#4ade80")


def eye(d, x, y, r=42):
    d.ellipse((x - r, y - r * 1.25, x + r, y + r * 1.25), fill=INK)
    d.ellipse((x - r * 0.35, y - r * 0.85, x + r * 0.15, y - r * 0.3), fill=WHITE)


def happy_eye(d, x, y, w=110):
    d.arc((x - w / 2, y - w / 2, x + w / 2, y + w / 2), 200, 340, fill=INK, width=26)


def heart(d, cx, cy, size, fill):
    pts = []
    for i in range(200):
        t = math.pi * 2 * i / 200
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * size / 32, cy - y * size / 32))
    d.polygon(pts, fill=fill)


def label(d, text, cy, size, fill=WHITE, box=None, cx=512):
    f = font(size)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    w, h = r - l, b - t
    if box:
        pad_x, pad_y = size * 0.45, size * 0.3
        d.rounded_rectangle((cx - w / 2 - pad_x, cy - h / 2 - pad_y, cx + w / 2 + pad_x, cy + h / 2 + pad_y),
                            radius=size * 0.5, fill=box)
    d.text((cx - w / 2 - l, cy - h / 2 - t), text, font=f, fill=fill)


def smile(d):
    face(d)
    eye(d, 400, 450); eye(d, 624, 450)
    d.arc((340, 430, 684, 720), 20, 160, fill=INK, width=30)
    d.ellipse((300, 560, 370, 610), fill="#86efac"); d.ellipse((654, 560, 724, 610), fill="#86efac")


def laugh(d):
    face(d)
    happy_eye(d, 400, 470); happy_eye(d, 624, 470)
    d.chord((340, 470, 684, 760), 0, 180, fill=INK)
    d.chord((420, 640, 604, 760), 200, 340, fill=RED)
    for x in (300, 724):  # tears
        d.ellipse((x - 34, 520, x + 34, 600), fill=SKY)


def love(d):
    face(d)
    heart(d, 400, 450, 150, RED); heart(d, 624, 450, 150, RED)
    d.arc((370, 480, 654, 700), 20, 160, fill=INK, width=30)


def wink(d):
    face(d)
    eye(d, 400, 450)
    d.line((570, 455, 680, 455), fill=INK, width=30)
    d.arc((360, 470, 664, 700), 15, 165, fill=INK, width=30)
    d.ellipse((560, 610, 640, 690), fill=RED)  # tongue tip


def sad(d):
    face(d, fill="#4ade80")
    eye(d, 400, 460, 38); eye(d, 624, 460, 38)
    d.arc((400, 610, 624, 780), 200, 340, fill=INK, width=28)
    d.polygon([(690, 520), (660, 600), (720, 600)], fill=SKY); d.ellipse((660, 570, 720, 630), fill=SKY)


def wow(d):
    face(d)
    eye(d, 400, 440, 46); eye(d, 624, 440, 46)
    d.ellipse((452, 580, 572, 720), fill=INK)
    d.arc((330, 330, 450, 380), 200, 340, fill=INK, width=20); d.arc((574, 330, 694, 380), 200, 340, fill=INK, width=20)


def big_heart(d):
    heart(d, 512, 540, 760, RED)
    heart(d, 420, 400, 170, "#f87171")


def ok(d):
    d.rounded_rectangle((150, 300, 874, 724), radius=150, fill=DARK)
    label(d, "OK!", 512, 300)


def thanks(d):
    d.rounded_rectangle((90, 250, 934, 700), radius=140, fill=GREEN)
    d.polygon([(260, 680), (230, 840), (420, 690)], fill=GREEN)
    label(d, "Thanks!", 470, 170, fill=WHITE)
    heart(d, 810, 270, 150, RED)


def hi(d):
    d.ellipse((150, 200, 874, 924), fill=GOLD)
    label(d, "Hi!", 560, 300, fill=INK)
    for a in (-150, -120, -90, -60, -30):  # sparkle rays above the badge
        rad = math.radians(a)
        d.line((512 + 400 * math.cos(rad), 560 + 400 * math.sin(rad), 512 + 470 * math.cos(rad),
                560 + 470 * math.sin(rad)), fill=DARK, width=30)


def done(d):
    d.ellipse((182, 120, 842, 780), fill=GREEN)
    d.line([(345, 450), (470, 575), (690, 340)], fill=WHITE, width=80, joint="curve")
    label(d, "Done", 880, 130, fill=WHITE, box=DARK)


def chai(d):
    d.rounded_rectangle((250, 420, 700, 860), radius=70, fill=GOLD)
    d.rectangle((250, 420, 700, 520), fill=GOLD)
    d.ellipse((250, 380, 700, 470), fill="#b45309")
    d.arc((640, 520, 820, 740), 270, 90, fill=GOLD, width=50)
    for x in (360, 475, 590):
        d.arc((x - 50, 160, x + 50, 300), 90, 270, fill="#94a3b8", width=22)
        d.arc((x - 50, 260, x + 50, 360), 270, 90, fill="#94a3b8", width=22)
    label(d, "Chai?", 660, 110, fill=INK)


def star(d):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        r = 400 if i % 2 == 0 else 170
        pts.append((512 + r * math.cos(a), 470 + r * math.sin(a)))
    d.polygon(pts, fill=GOLD)
    label(d, "Great job!", 880, 112, fill=WHITE, box=DARK)


def party(d):
    d.polygon([(260, 860), (420, 330), (720, 640)], fill=PINK)
    d.polygon([(330, 640), (395, 430), (520, 560)], fill=GOLD)
    for x, y, c in ((600, 200, GREEN), (760, 330, SKY), (700, 470, GOLD), (520, 250, RED), (840, 560, PINK), (430, 170, SKY)):
        d.rounded_rectangle((x - 22, y - 40, x + 22, y + 40), radius=14, fill=c)
    label(d, "Congrats!", 880, 112, fill=WHITE, box=DARK)


STICKERS = {
    "smile": smile, "laugh": laugh, "love": love, "wink": wink, "sad": sad, "wow": wow,
    "heart": big_heart, "ok": ok, "thanks": thanks, "hi": hi, "done": done, "chai": chai, "star": star,
    "party": party,
}


def die_cut(art: Image.Image) -> Image.Image:
    alpha = art.getchannel("A")
    outline = alpha
    for _ in range(4):
        outline = outline.filter(ImageFilter.MaxFilter(9))
    outline = outline.point(lambda v: 255 if v > 0 else 0).filter(ImageFilter.GaussianBlur(1.5))
    shadow = outline.filter(ImageFilter.GaussianBlur(14)).point(lambda v: v * 0.28)
    out = Image.new("RGBA", art.size, (0, 0, 0, 0))
    out.paste((15, 23, 42, 255), (0, 10), shadow)
    out.paste((255, 255, 255, 255), (0, 0), outline)
    return Image.alpha_composite(out, art)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, draw in STICKERS.items():
        art = canvas()
        draw(ImageDraw.Draw(art))
        # keep everything inside the frame with room for the outline
        art = art.resize((int(S * 0.88), int(S * 0.88)), Image.Resampling.LANCZOS)
        framed = canvas()
        framed.paste(art, (int(S * 0.06), int(S * 0.05)), art)
        final = die_cut(framed).resize((512, 512), Image.Resampling.LANCZOS)
        final.save(OUT / f"{name}.png", optimize=True)
        print(name, (OUT / f"{name}.png").stat().st_size)


if __name__ == "__main__":
    main()
