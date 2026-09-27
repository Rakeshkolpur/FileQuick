"""
AI image upscaling / enhancing for the conversion server — Real-ESRGAN
(general-x4v3, BSD-3-Clause, Xintao Wang et al.) run with OpenCV's DNN module
on the CPU. No PyTorch / GPU needed; the model is models/realesr-general-x4v3.onnx
(built from the official weights by tools/make_upscale_model.py).

The network enlarges 4x and at the same time removes noise, blur and JPEG
blockiness. Any output size is made from that: 4x as is, 2x / 1x ("enhance")
by high-quality downsampling of the 4x result. The image is processed in
overlapping tiles so memory stays small and progress can be reported.
"""
import os
import threading

import cv2
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "realesr-general-x4v3.onnx")
MODEL_SCALE = 4
MAX_MODEL_INPUT_PX = 2_000_000   # ~1 minute on 2 CPU cores
MAX_OUTPUT_PX = 36_000_000       # e.g. 6000 x 6000

_local = threading.local()


def available():
    return os.path.isfile(MODEL_PATH)


def _net():
    net = getattr(_local, "net", None)
    if net is None:
        net = cv2.dnn.readNetFromONNX(MODEL_PATH)
        _local.net = net
    return net


def _pixel_shuffle(f, r):
    """(C*r*r, h, w) -> (C, h*r, w*r) — same as torch.nn.functional.pixel_shuffle."""
    c = f.shape[0] // (r * r)
    h, w = f.shape[1], f.shape[2]
    return f.reshape(c, r, r, h, w).transpose(0, 3, 1, 4, 2).reshape(c, h * r, w * r)


def run_x4(bgr, tile=160, pad=16, progress=None, cancelled=None):
    """uint8 BGR (h, w, 3) -> uint8 BGR (4h, 4w, 3), processed tile by tile."""
    h, w = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    x = rgb.transpose(2, 0, 1)  # CHW
    s = MODEL_SCALE
    out = np.empty((h * s, w * s, 3), dtype=np.uint8)
    net = _net()
    boxes = [(y, xx, min(y + tile, h), min(xx + tile, w)) for y in range(0, h, tile) for xx in range(0, w, tile)]
    for i, (y0, x0, y1, x1) in enumerate(boxes):
        if cancelled and cancelled():
            raise RuntimeError("cancelled")
        # the tile plus a margin, so tile borders don't show
        py0, px0 = max(0, y0 - pad), max(0, x0 - pad)
        py1, px1 = min(h, y1 + pad), min(w, x1 + pad)
        inp = np.ascontiguousarray(x[:, py0:py1, px0:px1][None])
        net.setInput(inp)
        feat = net.forward()[0]
        res = _pixel_shuffle(feat, s) + np.repeat(np.repeat(inp[0], s, axis=1), s, axis=2)
        oy, ox = (y0 - py0) * s, (x0 - px0) * s
        crop = res[:, oy:oy + (y1 - y0) * s, ox:ox + (x1 - x0) * s]
        out[y0 * s:y1 * s, x0 * s:x1 * s] = (np.clip(crop, 0, 1) * 255.0 + 0.5).astype(np.uint8).transpose(1, 2, 0)
        if progress:
            progress((i + 1) / len(boxes))
    return cv2.cvtColor(out, cv2.COLOR_RGB2BGR)


def plan(w, h, scale):
    """Output size for w x h at `scale` (capped), and the size the model works at."""
    ow, oh = w * scale, h * scale
    capped = False
    if ow * oh > MAX_OUTPUT_PX:
        k = (MAX_OUTPUT_PX / (ow * oh)) ** 0.5
        ow, oh = max(1, int(ow * k)), max(1, int(oh * k))
        capped = True
    mw, mh = w, h
    if mw * mh > MAX_MODEL_INPUT_PX:
        k = (MAX_MODEL_INPUT_PX / (mw * mh)) ** 0.5
        mw, mh = max(1, int(mw * k)), max(1, int(mh * k))
    return (ow, oh), (mw, mh), capped


def enhance(img, scale, progress=None, cancelled=None):
    """
    img: uint8 HxW / HxWx3 (BGR) / HxWx4 (BGRA). scale: 1 (enhance), 2 or 4.
    Returns (result uint8 with the same channel layout, capped: bool).
    """
    alpha = None
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        alpha = img[:, :, 3]
        img = np.ascontiguousarray(img[:, :, :3])
    h, w = img.shape[:2]
    (ow, oh), (mw, mh), capped = plan(w, h, scale)
    src = img if (mw, mh) == (w, h) else cv2.resize(img, (mw, mh), interpolation=cv2.INTER_AREA)
    big = run_x4(src, progress=progress, cancelled=cancelled)
    bh, bw = big.shape[:2]
    if (bw, bh) != (ow, oh):
        interp = cv2.INTER_AREA if ow < bw else cv2.INTER_LANCZOS4
        big = cv2.resize(big, (ow, oh), interpolation=interp)
    if alpha is not None:
        big = np.dstack([big, cv2.resize(alpha, (ow, oh), interpolation=cv2.INTER_CUBIC)])
    return big, capped
