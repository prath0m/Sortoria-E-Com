"""Build Sartoria's logo assets from Cormorant Garamond glyph outlines.

Outputs (all regenerated on each run):
  frontend/public/brand/sartoria-wordmark.svg   burgundy wordmark + gold flourish
  frontend/public/brand/sartoria-monogram.svg   serif S in a fine gold ring
  frontend/public/favicon.svg                   monogram on burgundy, for browser tabs
  frontend/src/components/brand/logoPaths.ts    path data for the React components
  backend/static/brand/*.png                    raster copies for email clients and PDFs

Run from the repo root:  backend/.venv/bin/python scripts/build_brand_assets.py
"""

from pathlib import Path

import cairosvg
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "frontend/node_modules/@fontsource/cormorant-garamond/files"
BURGUNDY = "#590907"
GOLD = "#E8D258"
CREAM = "#F3EDE2"


def glyph_run(font: TTFont, text: str, tracking_em: float):
    """Return (svg path, width, cap_top, baseline) for `text` laid out with letter-spacing."""
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    tracking = tracking_em * upm
    pen = SVGPathPen(glyph_set)
    bounds = BoundsPen(glyph_set)
    x = 0.0
    names = [cmap[ord(ch)] for ch in text]
    for i, name in enumerate(names):
        # Flip Y so the SVG coordinate system matches font baseline at y=0.
        glyph_set[name].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        glyph_set[name].draw(TransformPen(bounds, (1, 0, 0, -1, x, 0)))
        x += glyph_set[name].width + (tracking if i < len(names) - 1 else 0)
    x_min, y_min, x_max, y_max = bounds.bounds
    return pen.getCommands(), (x_min, y_min, x_max, y_max)


def wordmark():
    font = TTFont(FONT_DIR / "cormorant-garamond-latin-500-normal.woff2")
    path, (x_min, y_min, x_max, y_max) = glyph_run(font, "SARTORIA", 0.30)
    pad = 24
    letters_w = x_max - x_min
    flourish_y = y_max + 105
    cx = x_min + letters_w / 2
    gap = 62
    stroke = 16
    width = letters_w + pad * 2
    height = flourish_y + 40 - y_min + pad
    vb = f"{x_min - pad:.0f} {y_min - pad:.0f} {width:.0f} {height:.0f}"
    # Hairlines that taper toward a small lozenge, like a needle's eye on a tailor's rule.
    left = (
        f"M{x_min + letters_w * 0.22:.1f} {flourish_y:.1f} "
        f"Q{cx - gap - 60:.1f} {flourish_y - 2:.1f} {cx - gap:.1f} {flourish_y:.1f}"
    )
    right = (
        f"M{cx + gap:.1f} {flourish_y:.1f} "
        f"Q{cx + gap + 60:.1f} {flourish_y + 2:.1f} {x_max - letters_w * 0.22:.1f} {flourish_y:.1f}"
    )
    d = 36
    lozenge = (
        f"M{cx:.1f} {flourish_y - d:.1f} L{cx + d:.1f} {flourish_y:.1f} "
        f"L{cx:.1f} {flourish_y + d:.1f} L{cx - d:.1f} {flourish_y:.1f} Z"
    )
    flourish = f"{left} {right}"
    return {
        "viewBox": vb,
        "letters": path,
        "flourish": flourish,
        "lozenge": lozenge,
        "stroke": stroke,
    }


def monogram():
    font = TTFont(FONT_DIR / "cormorant-garamond-latin-600-normal.woff2")
    path, (x_min, y_min, x_max, y_max) = glyph_run(font, "S", 0)
    glyph_w, glyph_h = x_max - x_min, y_max - y_min
    size = 1000
    target_h = 520
    scale = target_h / glyph_h
    tx = size / 2 - (x_min + glyph_w / 2) * scale
    ty = size / 2 - (y_min + glyph_h / 2) * scale
    return {
        "viewBox": f"0 0 {size} {size}",
        "letter": path,
        "transform": f"matrix({scale:.5f} 0 0 {scale:.5f} {tx:.2f} {ty:.2f})",
        "ring_r": 440,
        "ring_stroke": 14,
    }


def wordmark_svg(w, letter_fill=BURGUNDY):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{w["viewBox"]}" role="img" aria-label="Sartoria">'
        f'<path fill="{letter_fill}" d="{w["letters"]}"/>'
        f'<path fill="none" stroke="{GOLD}" stroke-width="{w["stroke"]}" stroke-linecap="round" '
        f'd="{w["flourish"]}"/>'
        f'<path fill="{GOLD}" d="{w["lozenge"]}"/></svg>'
    )


def monogram_svg(m, background=None, letter_fill=BURGUNDY):
    bg = f'<circle cx="500" cy="500" r="500" fill="{background}"/>' if background else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{m["viewBox"]}" role="img" aria-label="Sartoria">'
        f"{bg}"
        f'<circle cx="500" cy="500" r="{m["ring_r"]}" fill="none" stroke="{GOLD}" '
        f'stroke-width="{m["ring_stroke"]}"/>'
        f'<path fill="{GOLD}" d="M500 44 L516 60 L500 76 L484 60 Z"/>'
        f'<path fill="{letter_fill}" transform="{m["transform"]}" d="{m["letter"]}"/></svg>'
    )


def main():
    w, m = wordmark(), monogram()
    public = ROOT / "frontend/public"
    (public / "brand").mkdir(parents=True, exist_ok=True)
    (public / "brand/sartoria-wordmark.svg").write_text(wordmark_svg(w))
    (public / "brand/sartoria-wordmark-light.svg").write_text(wordmark_svg(w, letter_fill=CREAM))
    (public / "brand/sartoria-monogram.svg").write_text(monogram_svg(m))
    favicon = monogram_svg({**m, "ring_r": 400, "ring_stroke": 30}, background=BURGUNDY, letter_fill=CREAM)
    (public / "favicon.svg").write_text(favicon)

    static = ROOT / "backend/static/brand"
    static.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(bytestring=wordmark_svg(w).encode(), write_to=str(static / "wordmark.png"), output_width=720)
    cairosvg.svg2png(
        bytestring=wordmark_svg(w, letter_fill=CREAM).encode(),
        write_to=str(static / "wordmark-light.png"),
        output_width=720,
    )
    cairosvg.svg2png(bytestring=monogram_svg(m).encode(), write_to=str(static / "monogram.png"), output_width=256)
    cairosvg.svg2png(bytestring=favicon.encode(), write_to=str(public / "apple-touch-icon.png"), output_width=180)
    cairosvg.svg2png(bytestring=favicon.encode(), write_to=str(public / "icon-512.png"), output_width=512)
    (static / "wordmark.svg").write_text(wordmark_svg(w))
    (static / "monogram.svg").write_text(monogram_svg(m))

    ts = ROOT / "frontend/src/components/brand/logoPaths.ts"
    ts.write_text(
        "// Generated by scripts/build_brand_assets.py from Cormorant Garamond outlines. Do not edit.\n"
        f"export const WORDMARK = {{\n  viewBox: '{w['viewBox']}',\n  letters: '{w['letters']}',\n"
        f"  flourish: '{w['flourish']}',\n  lozenge: '{w['lozenge']}',\n  stroke: {w['stroke']},\n}} as const;\n\n"
        f"export const MONOGRAM = {{\n  viewBox: '{m['viewBox']}',\n  letter: '{m['letter']}',\n"
        f"  transform: '{m['transform']}',\n  ringR: {m['ring_r']},\n  ringStroke: {m['ring_stroke']},\n}} as const;\n"
    )
    print("brand assets written")


if __name__ == "__main__":
    main()
