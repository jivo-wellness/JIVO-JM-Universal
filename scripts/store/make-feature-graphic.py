"""Google Play feature graphic (1024x500): dark app background, the JM mark and the tagline in Inter.

Run: python scripts/store/make-feature-graphic.py   (needs Pillow; writes store/feature-graphic-1024x500.png)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

root = Path(__file__).resolve().parents[2]
inter = root / 'node_modules' / '@expo-google-fonts' / 'inter'
W, H = 1024, 500

# Background: the app's dark surface (#0c1210) with a soft green glow (sign-in backdrop) and a hint of blue behind the mark.
img = Image.new('RGB', (W, H), (12, 18, 16))
glow = Image.new('RGB', (W, H), (0, 0, 0))
d = ImageDraw.Draw(glow)
d.ellipse((-260, -320, 560, 380), fill=(16, 84, 52))
d.ellipse((620, 220, 1320, 820), fill=(18, 52, 92))
glow = glow.filter(ImageFilter.GaussianBlur(140))
img = Image.blend(img, glow, 0.55)

mark = Image.open(root / 'public' / 'icons' / 'icon-512.png').convert('RGBA')
bbox = mark.getbbox()
mark = mark.crop(bbox)
size = 300
mark = mark.resize((size, round(mark.height * size / mark.width)), Image.LANCZOS)
mx, my = 70, (H - mark.height) // 2
img.paste(mark, (mx, my), mark)

draw = ImageDraw.Draw(img)
title = ImageFont.truetype(str(inter / '800ExtraBold' / 'Inter_800ExtraBold.ttf'), 104)
sub = ImageFont.truetype(str(inter / '600SemiBold' / 'Inter_600SemiBold.ttf'), 40)
small = ImageFont.truetype(str(inter / '500Medium' / 'Inter_500Medium.ttf'), 30)
tx = mx + mark.width + 60
lines = [('JM', title, (241, 245, 249)), ('Messenger & Passwords', sub, (241, 245, 249)), ('for JIVO', small, (74, 222, 128))]
gaps = [18, 14]
heights = [draw.textbbox((0, 0), t, font=f)[3] - draw.textbbox((0, 0), t, font=f)[1] for t, f, _ in lines]
y = (H - (sum(heights) + sum(gaps))) // 2
for i, (text, font, color) in enumerate(lines):
    top = draw.textbbox((0, 0), text, font=font)[1]
    draw.text((tx, y - top), text, font=font, fill=color)
    y += heights[i] + (gaps[i] if i < len(gaps) else 0)
# Accent rule under the title block.
draw.rounded_rectangle((tx, y + 26, tx + 96, y + 32), radius=3, fill=(21, 128, 61))

out = root / 'store' / 'feature-graphic-1024x500.png'
img.save(out)
print(out, img.size)
