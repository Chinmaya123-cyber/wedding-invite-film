"""Turn generated art in <project>/img/raw/ into film-ready files, then write img/manifest.json.

usage: python -I cutout.py <project> [name ...] [--manifest-only]

  wall, plates (theme.plates, event plates), anything named plate_*  → copied as JPEG (no cut-out)
  window   → background removed AND the flat magenta opening punched out (the hole the camera flies through)
  banner, door-role props, portrait → solid cut-out (holes filled: the subject is one opaque piece)
  everything else (roof, rider, props) → plain cut-out (rembg isnet-general-use)

The manifest stores each image's file and aspect ratio, and the window opening as fractions of the window image —
the engine reads sizes from it, so a regenerated asset never needs code changes.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(sys.argv[1]).resolve()
names = [a for a in sys.argv[2:] if not a.startswith("--")]
only_manifest = "--manifest-only" in sys.argv
img, raw = root / "img", root / "img" / "raw"
theme = json.loads((root / "theme.json").read_text())
invite = json.loads((root / "invite.json").read_text()) if (root / "invite.json").exists() else {}

flat = {"wall", *theme.get("plates", {}).keys(), *(e.get("plate") for e in invite.get("events", []))}
solid = {"banner", "portrait", *(p["name"] for p in theme.get("props", []) if p.get("role") == "door")}


def kind(name):
    if name in flat or name.startswith("plate_"):
        return "flat"
    if name == "window":
        return "window"
    return "solid" if name in solid else "cut"


def process(src):
    from rembg import remove, new_session  # only needed when cutting
    from scipy import ndimage
    name, k = src.stem, kind(src.stem)
    im = Image.open(src).convert("RGB")
    if k == "flat":
        im.thumbnail((3200, 3200))
        im.save(img / f"{name}.jpg", quality=90)
        return name, k
    global SESSION
    try:
        SESSION
    except NameError:
        SESSION = new_session("isnet-general-use")
    a = np.asarray(remove(im, session=SESSION, only_mask=True, post_process_mask=True)).astype(np.float32) / 255
    rgb = np.asarray(im).astype(np.float32)
    # The art is painted on a flat grey. rembg alone drops pale subjects (white linen, a white apron), so also keep
    # every pixel that is clearly not that grey; enclosed grey (inside a wheel) still counts as background.
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bgc = np.median(border, axis=0)
    far = np.abs(rgb - bgc).max(-1)
    not_bg = ndimage.binary_opening(far > 16, iterations=2)
    border_bg = ndimage.label(~not_bg)[0]
    edge_labels = set(np.unique(np.concatenate([border_bg[0], border_bg[-1], border_bg[:, 0], border_bg[:, -1]]))) - {0}
    outside = np.isin(border_bg, list(edge_labels))       # grey connected to the image edge
    if k == "window":
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        mag = np.clip(((r + b) / 2 - g - 90) / 60, 0, 1)
        a = ndimage.gaussian_filter((~outside).astype(np.float32), 0.8) * (1 - mag)
    elif k == "solid":
        m = ndimage.binary_fill_holes(~outside | (a > 0.5))
        a = ndimage.gaussian_filter(m.astype(np.float32), 1.0)
    else:
        a = np.maximum(a, ndimage.gaussian_filter((not_bg & ~outside).astype(np.float32), 0.8))
    out = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), "RGBA")
    out = out.crop(out.getbbox())
    if name != "window":                # the window is zoomed 5×; keep it full size
        out.thumbnail((1400, 1400))
    out.save(img / f"{name}.png")
    return name, k


def window_hole(path):
    from scipy import ndimage
    a = np.asarray(Image.open(path))[..., 3]
    h, w = a.shape
    lab, _ = ndimage.label(a < 30)
    c = lab[h // 2, w // 2]
    if c == 0:
        raise SystemExit("window.png: the centre is not transparent — regenerate the window with a flat magenta opening")
    ys, xs = np.where(lab == c)
    return {"x0": round(xs.min() / w, 4), "y0": round(ys.min() / h, 4),
            "w": round((xs.max() + 1 - xs.min()) / w, 4), "h": round((ys.max() + 1 - ys.min()) / h, 4)}


if not only_manifest and raw.exists():
    for src in sorted(raw.glob("*")):
        if src.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp") or (names and src.stem not in names):
            continue
        print("%-14s %s" % process(src))

man = {}
for f in sorted(img.glob("*")):
    if f.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
        continue
    if f.stem in man and f.suffix.lower() != ".png":   # prefer the cut-out when both exist
        continue
    w, h = Image.open(f).size
    man[f.stem] = {"file": f.name, "w": w, "h": h, "ar": round(w / h, 5)}
if "window" in man:
    man["window"]["hole"] = window_hole(img / man["window"]["file"])
(img / "manifest.json").write_text(json.dumps(man, indent=1))

need = {"wall", "window", "banner", *(e.get("plate") for e in invite.get("events", []))}
opts = invite.get("options", {})
if opts.get("roofFigure", True): need.add("roof")
if opts.get("rider", True): need.add("rider")
missing = sorted(n for n in need if n and n not in man)
print(json.dumps({"manifest": str(img / "manifest.json"), "images": len(man), "missing": missing}, indent=1))
