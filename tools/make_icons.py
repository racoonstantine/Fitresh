"""Regenerates every app icon from the leaf-F in public/icon-512.png (or a better source passed as argv[1]).

    python tools/make_icons.py [source.png]

The letter's shape is lifted out of the source as a soft mask, sharpened at 4096px, and re-coloured with the
source's own green gradient, so every size is crisp. Swap in the original brand vector/PNG as the source
whenever it is available and re-run.
"""
import base64
import io
import os
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUBLIC = os.path.join(ROOT, 'public')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(PUBLIC, 'icon-512.png')
BG = (19, 42, 38)          # the icon's dark green
BIG = 4096


def extract():
    src = Image.open(SRC).convert('RGB')
    w, h = src.size
    rgb = np.asarray(src).astype(np.float32)
    # leaf pixels are bright green; the background is dark (g < ~75)
    soft = np.clip((rgb[..., 1] - 75) / 40, 0, 1)
    blur = lambda a, r: np.asarray(Image.fromarray(a).filter(ImageFilter.GaussianBlur(r)))
    # colour comes only from the letter's solid interior (its outer pixels carry a dark rim from the source),
    # spread outward by normalised convolution
    core_img = Image.fromarray(((soft > 0.97) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7))
    core = np.asarray(core_img).astype(np.float32) / 255
    den = blur((core * 255).astype(np.uint8), w / 40).astype(np.float32) / 255 + 1e-4
    chans = [np.clip(blur((rgb[..., i] * core).astype(np.uint8), w / 40).astype(np.float32) / den, 0, 255) for i in range(3)]
    colour = Image.fromarray(np.dstack(chans).astype(np.uint8), 'RGB').resize((BIG, BIG), Image.BICUBIC)
    # crisp edge: upscale the soft mask, then a narrow threshold ramp
    m = Image.fromarray((soft * 255).astype(np.uint8)).resize((BIG, BIG), Image.LANCZOS).filter(ImageFilter.GaussianBlur(BIG / 700))
    mask = m.point(lambda v: 0 if v < 118 else (255 if v > 138 else int((v - 118) * 255 / 20)))
    # drop stray specks: keep only what survives an opening, grown back slightly
    keep = mask.point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.MinFilter(41)).filter(ImageFilter.MaxFilter(61))
    mask = ImageChops.multiply(mask, keep)
    return colour, mask


COLOUR, MASK = extract()
bbox = MASK.point(lambda v: 255 if v > 128 else 0).getbbox()
GLYPH_W = bbox[2] - bbox[0]


def glyph_layer(size, glyph_frac):
    """The F alone on a transparent square of `size`, its width = glyph_frac of the square, centred on its box."""
    crop_box = bbox
    c = COLOUR.crop(crop_box); m = MASK.crop(crop_box)
    scale = size * glyph_frac / GLYPH_W
    nw, nh = max(1, round(c.width * scale)), max(1, round(c.height * scale))
    c = c.resize((nw, nh), Image.LANCZOS); m = m.resize((nw, nh), Image.LANCZOS)
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    layer.paste(Image.merge('RGBA', (*c.split(), m)), ((size - nw) // 2, (size - nh) // 2), Image.merge('RGBA', (*c.split(), m)))
    return layer


def icon(size, glyph_frac=0.52, rounded=True, radius=0.22):
    ss = 4
    big = size * ss
    base = Image.new('RGBA', (big, big), BG + (255,))
    base.alpha_composite(glyph_layer(big, glyph_frac))
    if rounded:
        corner = Image.new('L', (big, big), 0)
        ImageDraw.Draw(corner).rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * radius), fill=255)
        base.putalpha(ImageChops.multiply(base.getchannel('A'), corner))
    return base.resize((size, size), Image.LANCZOS)


def save(img, rel):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print('wrote', rel, img.size)


# --- web / PWA ---
save(icon(512), 'public/icon-512.png')
save(icon(192), 'public/icon-192.png')
save(icon(180, rounded=False).convert('RGB'), 'public/apple-touch-icon.png')       # iOS rounds it itself
save(icon(512, glyph_frac=0.40, rounded=False), 'public/icon-maskable-512.png')    # glyph inside the 80% safe circle
save(icon(168, glyph_frac=0.52), 'public/mark.png')                                 # in-app logo (shown at 28-56px)

buf = io.BytesIO(); icon(128).save(buf, 'PNG', optimize=True)
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><image href="data:image/png;base64,%s" width="128" height="128"/></svg>'
       % base64.b64encode(buf.getvalue()).decode())
open(os.path.join(PUBLIC, 'favicon.svg'), 'w', newline='').write(svg)
print('wrote public/favicon.svg')

# --- Android (consumed by @capacitor/assets) ---
save(icon(1024, rounded=False), 'resources/icon-only.png')
save(glyph_layer(1024, 0.40), 'resources/icon-foreground.png')                     # adaptive icon: glyph in the safe zone
save(Image.new('RGB', (1024, 1024), BG), 'resources/icon-background.png')
