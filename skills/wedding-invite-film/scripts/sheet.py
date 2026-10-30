"""Contact sheet of a project's paintings for checking: cut-outs on green (halos, holes and leftover background
show up), the window's opening, plates and wall as they are. → <project>/out/check_sheet.jpg

usage: python -I sheet.py <project>
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1]).resolve()
man = json.loads((root / "img/manifest.json").read_text())
H, tiles = 300, []
for name, m in man.items():
    im = Image.open(root / "img" / m["file"]).convert("RGBA")
    im = im.resize((max(1, int(im.width * H / im.height)), H))
    bg = Image.new("RGBA", im.size, (38, 150, 70, 255))
    bg.alpha_composite(im)
    d = ImageDraw.Draw(bg)
    d.rectangle([0, 0, len(name) * 7 + 8, 16], fill=(0, 0, 0, 200))
    d.text((4, 2), name, fill=(255, 255, 255, 255))
    tiles.append(bg.convert("RGB"))
rows, row, w = [], [], 0
for t in tiles:
    if w + t.width > 2000 and row:
        rows.append(row); row, w = [], 0
    row.append(t); w += t.width + 6
rows.append(row)
sheet = Image.new("RGB", (2000, len(rows) * (H + 6)), (24, 24, 24))
for r, rr in enumerate(rows):
    x = 0
    for t in rr:
        sheet.paste(t, (x, r * (H + 6))); x += t.width + 6
(root / "out").mkdir(exist_ok=True)
sheet.save(root / "out/check_sheet.jpg", quality=85)
print(root / "out/check_sheet.jpg")
