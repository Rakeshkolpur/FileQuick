"""
Key the baked-in transparency checkerboard out of the 5 supplied frame PNGs.
Works at the 1600px output size. Strategy:
  1. detect the frame's two grey checker tones from its border ring
  2. binary-flood every checker-like pocket, starting from the border + centre,
     spreading through all connected checker-like pixels (no colour threshold —
     pure connectivity), so trapped inter-ring bands are cleared too
  3. restore (re-opaque) any transparent blob that is small AND fully enclosed
     by art — those are grey art details (crown pearls, rose highlights), not
     real holes
  4. feather the cut, write WebP + 160px thumb
  5. report each frame's inner-opening radius (fraction of half-width) — the
     component scales the overlay by PHOTO_FRAMES[].fit so this opening lands
     just outside the photo circle instead of covering the face.
"""
import os
import numpy as np
from PIL import Image, ImageFilter

SRC = "src/assets/frames"
OUT = "public/frames"
THUMB = os.path.join(OUT, "thumb")
os.makedirs(THUMB, exist_ok=True)
N = 1600

# every .png in src/assets/frames/ is processed. Pass names on the command line
# to limit it, e.g.  python scripts/optimise-frames.py my-new-frame
import sys
NAMES = sys.argv[1:] or sorted(
    os.path.splitext(f)[0] for f in os.listdir(SRC) if f.lower().endswith(".png")
)

# per-frame checkerboard-key tuning: (chroma tolerance, luma band pad, min area
# to clear a trapped band). DEFAULT suits clean art on a plain checkerboard; add
# an entry only if a frame keeps stray checker specks or loses grey detail.
DEFAULT_TUNE = (22, 26, 5000)
TUNE = {
    "gaming-neon": (60, 55, 900),   # neon bloom tints the checker blue/purple
}


def detect_checker(arr):
    h, w, _ = arr.shape
    m = max(6, w // 22)
    ring = np.concatenate([arr[:m].reshape(-1, 3), arr[-m:].reshape(-1, 3),
                           arr[:, :m].reshape(-1, 3), arr[:, -m:].reshape(-1, 3)])
    ch = ring.max(1).astype(int) - ring.min(1).astype(int)
    lum = np.round(ring[ch < 16].mean(1)).astype(int)
    v, c = np.unique(lum, return_counts=True)
    top = v[np.argsort(c)[::-1][:8]]
    return int(top.min()), int(top.max())


def flood_binary(seed, allowed):
    """Grow `seed` through 4-connected `allowed` pixels until stable."""
    m = seed & allowed
    while True:
        nb = np.zeros(m.shape, np.uint8)
        nb[1:] |= m[:-1]; nb[:-1] |= m[1:]
        nb[:, 1:] |= m[:, :-1]; nb[:, :-1] |= m[:, 1:]
        grow = allowed & (nb > 0) & ~m
        if not grow.any():
            return m
        m |= grow


def label_components(mask):
    """Tiny 4-connectivity CC labeller (mask is modest size at 1200px)."""
    lab = np.zeros(mask.shape, np.int32)
    cur = 0
    idx = np.argwhere(mask)
    seen = ~mask
    from collections import deque
    for y0, x0 in idx:
        if seen[y0, x0]:
            continue
        cur += 1
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        while q:
            y, x = q.popleft()
            lab[y, x] = cur
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] \
                        and not seen[ny, nx] and mask[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
    return lab, cur


for name in NAMES:
    raw = Image.open(os.path.join(SRC, name + ".png"))
    im = raw.convert("RGB").resize((N, N), Image.LANCZOS)

    # If the PNG already carries real transparency (made to spec), keep its
    # alpha as-is and skip the checkerboard keying entirely.
    src_alpha = raw.getchannel("A") if raw.mode in ("RGBA", "LA") else None
    already_keyed = src_alpha is not None and (np.asarray(src_alpha) < 8).mean() > 0.15

    if already_keyed:
        a = src_alpha.convert("L").resize((N, N), Image.LANCZOS)
        out = im.convert("RGBA")
        out.putalpha(a)
    else:
        arr = np.asarray(im).astype(int)
        lo, hi = detect_checker(np.asarray(im))
        cht, pad, min_area = TUNE.get(name, DEFAULT_TUNE)
        chroma = arr.max(2) - arr.min(2)
        luma = arr.mean(2)
        # generous "could be checker" test — grey and within the tone band
        checker_like = (chroma < cht) & (luma > lo - pad) & (luma < hi + pad)

        seed = np.zeros((N, N), bool)
        seed[:3] = seed[-3:] = seed[:, :3] = seed[:, -3:] = True  # border
        c = N // 2                                                # centre hole
        seed[c - 6:c + 6, c - 6:c + 6] = True

        transp = flood_binary(seed, checker_like)

        # restore small enclosed grey details (crown pearls, rose highlights)
        holes = checker_like & ~transp
        lab, n = label_components(holes)
        if n:
            areas = np.bincount(lab.ravel())
            big = [i for i in range(1, n + 1) if areas[i] > min_area]
            transp |= np.isin(lab, big) if big else np.zeros_like(holes)

        alpha = np.where(transp, 0, 255).astype(np.uint8)
        a = Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
        out = im.convert("RGBA")
        out.putalpha(a)

    pct = (np.asarray(a) < 8).mean() * 100

    # inner-opening radius: how far the clear centre reaches, as a fraction of
    # the half-width (1.0 == the photo-circle edge). fit ≈ 0.72 / inner.
    af = np.asarray(a)
    yy, xx = np.mgrid[0:N, 0:N]
    rr = np.sqrt((xx - N / 2) ** 2 + (yy - N / 2) ** 2) / (N / 2)
    inner = 0.0
    for i in range(20):
        m = (rr >= i / 20) & (rr < (i + 1) / 20)
        if m.any() and (af[m] > 40).mean() < 0.06:
            inner = (i + 1) / 20
        else:
            break
    fit = round(0.72 / inner, 2) if inner else 1.4

    out.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=90, method=6)
    out.resize((160, 160), Image.LANCZOS).save(os.path.join(THUMB, name + ".webp"), "WEBP", quality=88, method=6)
    kb = os.path.getsize(os.path.join(OUT, name + ".webp")) / 1024
    tag = "kept alpha" if already_keyed else "keyed checker"
    print(f"{name:20s} {tag:13s} transparent {pct:4.1f}%   "
          f"inner r={inner:.2f}  suggested fit={fit}   {kb:6.1f} KB")
