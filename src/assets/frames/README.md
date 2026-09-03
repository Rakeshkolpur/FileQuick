# Decorative frame source art

Drop new hi‑res frame PNGs in this folder, then run the optimiser and register them.

## Exact art spec

| | value |
|---|---|
| Canvas | **2000 × 2000 px** square (1600 minimum) |
| Format | **PNG with a real alpha channel.** Not a JPG, not a PNG with a grey/white **checkerboard** painted into the see‑through area — that has to be keyed out by hand and never comes out perfect. |
| Clear centre | Leave a **circle 72 % of the width (≈1440 px), centred, completely empty** (fully transparent). The photo / face shows here. |
| Border art | Everything from that 72 % circle **outward to the edges**. It may bleed off all four sides — the app clips the overlay to a circle, so corners and anything past the edge are trimmed automatically. |
| Comfortable inner edge | ~**80 %** of width if you want a little breathing room around the face. |
| Symmetry | Design it to read centred (a wreath, a ring, a top‑weighted crown). Don't put the whole motif in one corner. |
| Soft inner edge | A slight fade where the art meets the clear centre looks natural — fine to do. |

If you hit that 72 % clear centre, the frame drops in with `fit: 1.0` (no scaling,
sharpest result). Thicker rings still work — the code scales them out via
`PHOTO_FRAMES[].fit` and the "Frame size" slider — they're just a touch softer.

## Adding a frame

1. Save `my-frame.png` here (2000², transparent).
2. From the repo root: `python scripts/optimise-frames.py`
   (add the new name to the `NAMES` list in that script first).
   It writes `public/frames/my-frame.webp` + `public/frames/thumb/my-frame.webp`
   and prints a **suggested `fit`** value.
3. Add a line to `PHOTO_FRAMES` in
   `src/components/tools/image/ProfilePictureMaker.jsx`:
   ```js
   { id: 'my-frame', name: 'My Frame', src: '/frames/my-frame.webp', thumb: '/frames/thumb/my-frame.webp', fit: 1.0 },
   ```
   Use `fit: 1.0` if you followed the 72 % spec, otherwise the printed value.

The source PNGs here are git‑ignored (they're large); only the optimised
`public/frames/*.webp` are committed.
