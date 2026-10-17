"""Scanned pages for the PDF -> Word engine.

The browser reads a scanned page with OCR (any language Tesseract knows,
Hindi / Telugu / Kannada / Tamil … included) and sends what it found as JSON:
every word with its box, each line's baseline and boldness, and the table
cells it saw. This turns that into the same "spans" the engine gets from a
digital PDF, so a scan comes out with the same flowing paragraphs, alignment,
indents and tables.

Which font? OCR boxes hug the ink of each word. For the right font, every
word's ink width divided by that font's ink width for the same letters gives
the same text size; for a wrong font (other letter proportions) the sizes
scatter. So the page's font is the candidate whose per-word sizes agree best,
and that agreement also gives the size itself — no guessing from line height,
which scanner blur inflates.

Indian-script text is set in Nirmala UI (Windows' font for all of them).

spec (PDF points, origin top-left):
  {"lines": [{"base": y, "bold": bool, "cell": bool,
              "words": [{"t": "text", "x0":…, "y0":…, "x1":…, "y1":…}]}],
   "cells": [[x0, y0, x1, y1], …]}
"""
from __future__ import annotations

import os
import re
import statistics

INDIC = re.compile('[\u0900-\u0dff\u0600-\u06ff]')     # Devanagari … Malayalam, plus Urdu
INDIC_FONT = 'Nirmala UI'
BULLET_LOOKALIKES = set('eoO0*«»°·•●▪■◦-–>»')

# Word fonts -> files with the same letter shapes / widths (Windows, then the
# Linux look-alikes the server has). A font missing on the machine is skipped.
_FILES = {
    ('Times New Roman', False): ['C:/Windows/Fonts/times.ttf', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'],
    ('Times New Roman', True): ['C:/Windows/Fonts/timesbd.ttf', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'],
    ('Arial', False): ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'],
    ('Arial', True): ['C:/Windows/Fonts/arialbd.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'],
    ('Calibri', False): ['C:/Windows/Fonts/calibri.ttf', '/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf'],
    ('Calibri', True): ['C:/Windows/Fonts/calibrib.ttf', '/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf'],
    ('Cambria', False): ['C:/Windows/Fonts/cambria.ttc', '/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf'],
    ('Cambria', True): ['C:/Windows/Fonts/cambriab.ttf', '/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf'],
    ('Georgia', False): ['C:/Windows/Fonts/georgia.ttf'],
    ('Georgia', True): ['C:/Windows/Fonts/georgiab.ttf'],
    ('Verdana', False): ['C:/Windows/Fonts/verdana.ttf'],
    ('Verdana', True): ['C:/Windows/Fonts/verdanab.ttf'],
    ('Tahoma', False): ['C:/Windows/Fonts/tahoma.ttf'],
    ('Tahoma', True): ['C:/Windows/Fonts/tahomabd.ttf'],
    ('Bookman Old Style', False): ['C:/Windows/Fonts/BOOKOS.TTF', '/usr/share/fonts/opentype/urw-base35/URWBookman-Light.otf'],
    ('Bookman Old Style', True): ['C:/Windows/Fonts/BOOKOSB.TTF', '/usr/share/fonts/opentype/urw-base35/URWBookman-Demi.otf'],
    ('Book Antiqua', False): ['C:/Windows/Fonts/BKANT.TTF', '/usr/share/fonts/opentype/urw-base35/P052-Roman.otf'],
    ('Book Antiqua', True): ['C:/Windows/Fonts/ANTQUAB.TTF', '/usr/share/fonts/opentype/urw-base35/P052-Bold.otf'],
    ('Century Gothic', False): ['C:/Windows/Fonts/GOTHIC.TTF', '/usr/share/fonts/opentype/urw-base35/URWGothic-Book.otf'],
    ('Century Gothic', True): ['C:/Windows/Fonts/GOTHICB.TTF', '/usr/share/fonts/opentype/urw-base35/URWGothic-Demi.otf'],
}
CANDIDATES = ['Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Georgia', 'Verdana', 'Tahoma',
              'Bookman Old Style', 'Book Antiqua', 'Century Gothic']


class _Metrics:
    """Advance width and side bearings (in em) of each letter of one font."""

    def __init__(self, path):
        from fontTools.ttLib import TTFont
        self.tt = TTFont(path, fontNumber=0, lazy=True)
        self.cmap = self.tt.getBestCmap() or {}
        self.gs = self.tt.getGlyphSet()
        self.upem = self.tt['head'].unitsPerEm
        self.hm = self.tt['hmtx'].metrics
        self.cache = {}

    def glyph(self, ch):
        if ch not in self.cache:
            g = self.cmap.get(ord(ch))
            if not g:
                self.cache[ch] = None
            else:
                from fontTools.pens.boundsPen import BoundsPen
                adv = self.hm[g][0] / self.upem
                bp = BoundsPen(self.gs)
                try:
                    self.gs[g].draw(bp)
                except Exception:  # noqa: BLE001
                    bp.bounds = None
                if bp.bounds:
                    self.cache[ch] = (adv, bp.bounds[0] / self.upem, adv - bp.bounds[2] / self.upem)
                else:
                    self.cache[ch] = (adv, 0.0, 0.0)
        return self.cache[ch]

    def adv(self, ch):
        g = self.glyph(ch)
        return g[0] if g else 0.5

    def ink_width(self, text):
        """Width of the word's ink in em (advances minus the outer side bearings)."""
        gs = [self.glyph(c) for c in text]
        if not text or any(g is None for g in gs):
            return None
        return sum(g[0] for g in gs) - gs[0][1] - gs[-1][2]


_CACHE = {}


def _metrics(fam, bold=False):
    key = (fam, bold)
    if key not in _CACHE:
        m = None
        for path in _FILES.get(key, []):
            if os.path.exists(path):
                try:
                    m = _Metrics(path)
                    break
                except Exception:  # noqa: BLE001
                    m = None
        if m is None and bold:
            m = _metrics(fam, False)
        _CACHE[key] = m
    return _CACHE[key]


def _words(line):
    return [w for w in line.get('words', []) if (w.get('t') or '').strip()]


def _clean_word(t):
    return t.strip('.,;:()[]"\'“”‘’!?')


def _word_sizes(m, ws):
    out = []
    for w in ws:
        t = _clean_word(w['t'])
        if len(t) < 3 or INDIC.search(t):
            continue
        iw = m.ink_width(t)
        if iw and iw > 0:
            out.append((w['x1'] - w['x0']) / iw)
    return out


def pick_family(spec, only=None):
    """(family, typical size): the font whose per-word sizes agree best.
    Each word is compared with its own line (documents mix sizes), so the
    spread measures only how well the font's letter proportions fit.
    `spec` may also be a list of page specs (one font for the whole document)."""
    specs = spec if isinstance(spec, list) else [spec]
    best = None
    for fam in ([only] if only else CANDIDATES):
        m = _metrics(fam, False)
        if m is None:
            continue
        rel, sizes = [], []
        for sp in specs:
            for ln in sp.get('lines', []):
                if ln.get('bold'):
                    continue
                sz = _word_sizes(m, [w for w in _words(ln) if not w.get('b')])
                if len(sz) >= 3:
                    md = statistics.median(sz)
                    rel += [z / md for z in sz]
                    sizes += sz
        if len(rel) < 8:
            continue
        q = statistics.quantiles(rel, n=4)
        spread = q[2] - q[0]
        if best is None or spread < best[1]:
            best = (fam, spread, statistics.median(sizes))
    if best is None:
        return (only or 'Arial'), None
    return best[0], best[2]


def _snap(size, common):
    """Body text is one size: a line close to the page's usual size (an OCR
    slip skews a short line) takes that size."""
    if common and abs(size - common) <= 0.12 * common:
        return common
    return size


def ocr_spans(spec, Span, family=None):
    """OCR'd lines -> engine Span objects (one per word, letters placed by
    the chosen font's own widths). `family`: the document's font, if known."""
    fam, common = pick_family(spec, only=family)
    if family and common is None:
        fam = family
    out = []
    for ln in spec.get('lines', []):
        ws = _words(ln)
        if not ws:
            continue
        bold = bool(ln.get('bold'))
        ink = max(w['y1'] for w in ws) - min(w['y0'] for w in ws)
        base = ln.get('base') or (max(w['y1'] for w in ws) - ink * 0.2)
        text = ' '.join(w['t'] for w in ws)
        m = _metrics(fam, bold)
        if INDIC.search(text) or m is None:
            size = max(4.0, ink / 1.25)        # Indian scripts: tall marks above and below
        else:
            sizes = _word_sizes(m, ws)
            size = statistics.median(sizes) if sizes else (common or ink / 0.92)
            size = _snap(size, common)
        exact = min(72.0, max(4.0, size))
        size = round(exact * 2) / 2
        # Word sizes go in half points: make up the difference with letter
        # spacing so each line stays as wide as on the scan
        em = statistics.mean(m.adv(c) for c in text if not c.isspace()) if (m and text.strip()) else 0.5
        track = (exact - size) * em if abs(exact - size) * em >= 0.03 else 0.0
        # OCR reads a list bullet as "e", "o", "«", "*" …: a small lone mark
        # at the start of a line, well apart from the text, is a bullet
        if len(ws) >= 2 and len(ws[0]['t'].strip()) == 1 and ws[0]['t'].strip() in BULLET_LOOKALIKES:
            w0, w1 = ws[0], ws[1]
            h0 = w0['y1'] - w0['y0']
            if h0 < 0.75 * ink and w1['x0'] - w0['x1'] > 0.45 * ink:
                ws = [dict(w0, t='•')] + ws[1:]
        for k, w in enumerate(ws):
            t = w['t'].strip()
            indic = bool(INDIC.search(t))
            wfam = INDIC_FONT if indic else fam
            wbold = bool(w.get('b', bold))       # bold measured word by word in the browser
            wm = _metrics(fam, wbold) or m
            chars = []
            if indic or wm is None:
                # no metrics: spread the letters evenly over the word's box
                step = (w['x1'] - w['x0']) / max(1, len(t))
                chars = [(ch, w['x0'] + i * step, w['x0'] + (i + 1) * step) for i, ch in enumerate(t)]
                end = w['x1']
            else:
                # the pen starts one left side bearing before the ink
                g0 = wm.glyph(t[0])
                x = w['x0'] - (g0[1] if g0 else 0) * size
                for ch in t:
                    a = wm.adv(ch) * size
                    chars.append((ch, x, x + a))
                    x += a
                end = max(x, w['x1'])
            if k + 1 < len(ws):
                nx = ws[k + 1]['x0']
                chars.append((' ', end, max(end + 0.1, nx)))
                t = t + ' '
            # the word spans from where Word's pen starts to where its last letter
            # ends (like a digital PDF's letter boxes), not just the ink
            ink_end = chars[len(t) - 1][2] if len(chars) >= len(t) else w['x1']
            out.append(Span(text=t, x0=chars[0][1], y0=base - size * 0.8, x1=ink_end, y1=base + size * 0.22, base=base,
                            size=size, font=wfam, bold=wbold, italic=False, color=w.get('c') or '000000', chars=chars,
                            track=0.0 if indic else track, tsize=exact))
    return out


def ocr_tables(spec, spans, Table):
    """Table cells the browser found -> engine Tables (+ the ruling lines)."""
    cells = [c for c in spec.get('cells', []) if c[2] - c[0] > 4 and c[3] - c[1] > 4]
    if not cells:
        return [], [], []
    # group cells into tables: cells that touch belong together
    groups = []
    for c in cells:
        hit = [g for g in groups if any(not (c[2] < o[0] - 3 or o[2] < c[0] - 3 or c[3] < o[1] - 3 or o[3] < c[1] - 3) for o in g)]
        merged = [c]
        for g in hit:
            merged += g
            groups.remove(g)
        groups.append(merged)
    tables, hrules, vrules = [], [], []

    def clus(vals, tol=3.0):
        vals = sorted(vals)
        res = []
        for v in vals:
            if res and v - res[-1][-1] <= tol:
                res[-1].append(v)
            else:
                res.append([v])
        return [sum(g) / len(g) for g in res]

    for g in groups:
        cols = clus([c[0] for c in g] + [c[2] for c in g])
        rows = clus([c[1] for c in g] + [c[3] for c in g])
        if len(cols) < 2 or len(rows) < 2:
            continue
        snap = lambda bounds, v: min(range(len(bounds)), key=lambda i: abs(bounds[i] - v))  # noqa: E731
        tc = []
        seen = set()
        for c in g:
            ci, ce, ri, re_ = snap(cols, c[0]), snap(cols, c[2]), snap(rows, c[1]), snap(rows, c[3])
            if ce <= ci or re_ <= ri or (ri, ci) in seen:
                continue
            seen.add((ri, ci))
            box = (cols[ci], rows[ri], cols[ce], rows[re_])
            tc.append({'r': ri, 'c': ci, 'rs': re_ - ri, 'cs': ce - ci, 'bbox': box, 'paras': [], 'lines': [],
                       'borders': {s: ('000000', 0.5) for s in ('top', 'bottom', 'left', 'right')}, 'shade': None})
            x0, y0, x1, y1 = box
            hrules += [(x0, x1, y0, '000000', 0.5), (x0, x1, y1, '000000', 0.5)]
            vrules += [(y0, y1, x0, '000000', 0.5), (y0, y1, x1, '000000', 0.5)]
        if tc:
            tables.append(Table(cols[0], rows[0], cols[-1], rows[-1], cols, rows, tc))
    return tables, hrules, vrules
