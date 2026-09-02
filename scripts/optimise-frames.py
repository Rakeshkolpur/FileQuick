"""
Key the baked-in transparency checkerboard out of the 5 supplied frame PNGs.
Works at the 1200px output size. Strategy:
  1. detect the frame's two grey checker tones from its border ring
  2. binary-flood every checker-like pocket, starting from the border + centre,
     spreading through all connected checker-like pixels (no colour threshold —
     pure connectivity), so trapped inter-ring bands are cleared too
  3. restore (re-opaque) any transparent blob that is small AND fully enclosed
     by art — those are grey art details (crown pearls, rose highlights), not
     real holes
  4. feather the cut, write WebP + 160px thumb
"""
import os
import numpy as np
from PIL import Image, ImageFilter

SRC = "src/assets/frames"
OUT = "public/frames"
THUMB = os.path.join(OUT, "thumb")
os.makedirs(THUMB, exist_ok=True)
NAMES = ["gold-crown", "love-hearts", "pink-kiss", "gaming-neon", "flower-butterfly"]
N = 1200

# per-frame tuning: (chroma tolerance, luma band pad, min area to clear a band)
TUNE = {
    "gold-crown":      (22, 26, 5000),
    "love-hearts":     (22, 26, 5000),
    "pink-kiss":       (22, 26, 5000),
    "gaming-neon":     (60, 55, 900),   # neon bloom tints the checker blue/purple
    "flower-butterfly": (22, 26, 5000),
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
    im = Image.open(os.path.join(SRC, name + ".png")).convert("RGB").resize((N, N), Image.LANCZOS)
    arr = np.asarray(im).astype(int)
    lo, hi = detect_checker(np.asarray(im))

    cht, pad, min_area = TUNE[name]
    chroma = arr.max(2) - arr.min(2)
    luma = arr.mean(2)
    # generous "could be checker" test — grey and within the tone band (plus the
    # anti-alias ramp between the two tones)
    checker_like = (chroma < cht) & (luma > lo - pad) & (luma < hi + pad)

    seed = np.zeros((N, N), bool)
    seed[:3] = seed[-3:] = seed[:, :3] = seed[:, -3:] = True  # border
    cy = cx = N // 2                                          # centre hole
    seed[cy - 6:cy + 6, cx - 6:cx + 6] = True

    transp = flood_binary(seed, checker_like)

    # restore small enclosed grey details
    holes = checker_like & ~transp
    lab, n = label_components(holes)
    if n:
        areas = np.bincount(lab.ravel())
        big = {i for i in range(1, n + 1) if areas[i] > min_area}  # keep big bands transparent
        keep_transparent = np.isin(lab, list(big)) if big else np.zeros_like(holes)
        transp |= keep_transparent

    alpha = np.where(transp, 0, 255).astype(np.uint8)
    a = Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert("RGBA")
    out.putalpha(a)

    pct = (np.asarray(a) < 8).mean() * 100
    out.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=90, method=6)
    out.resize((160, 160), Image.LANCZOS).save(os.path.join(THUMB, name + ".webp"), "WEBP", quality=88, method=6)
    kb = os.path.getsize(os.path.join(OUT, name + ".webp")) / 1024
    print(f"{name:18s} checker {lo:>3}/{hi:<3}  transparent {pct:4.1f}%   {kb:6.1f} KB")
