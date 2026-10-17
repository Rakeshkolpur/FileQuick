"""FileQuick PDF -> Word engine.

Rebuilds a real, editable Word document from a PDF's text layer instead of
pinning every PDF line in place:

  * lines are re-joined into flowing paragraphs — a line ends a paragraph only
    when the next line's first word would have fitted on it (Word's own greedy
    wrap rule), or the spacing / indent / style says so
  * alignment (left / centre / right / justified), indents, first-line indent,
    spacing before and line spacing are measured from the PDF
  * list items get a real hanging indent (marker, tab, text) and readable
    bullets (Symbol/Wingdings private-use glyphs -> Unicode)
  * ruled tables -> Word tables with merged cells, per-edge borders, shading
  * text repeated at the top / bottom of every page -> real header / footer,
    page numbers become a PAGE field
  * two-column page areas -> a two-column section
  * underline / strike-through drawn as lines, highlight boxes, links, images
  * PostScript font names -> the Word family (TimesNewRomanPS-BoldMT ->
    Times New Roman + bold)

Only needs PyMuPDF. `convert(pdf_path, docx_path, pages=None)`.
"""
from __future__ import annotations

import contextvars
import math
import re
import statistics
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from xml.sax.saxutils import escape

import pymupdf

try:
    from fq_fonts import FontBook, obfuscate, OBFUSCATED
except Exception:  # noqa: BLE001
    FontBook = None
try:
    from fq_ocr import ocr_spans, ocr_tables
except Exception:  # noqa: BLE001
    ocr_spans = ocr_tables = None

TW = 20          # twips per point
EMU = 12700      # EMU per point

# ----------------------------------------------------------------------------
# fonts
# ----------------------------------------------------------------------------

# How Word lays out one line of a font, measured in Word itself (÷ font size):
# (single line height, baseline below the top of that line). With "at least"
# spacing the extra room goes above the text; with "exact" spacing the
# baseline sits at 0.8 of the line height whatever the font.
WORD_METRICS = {
    'Times New Roman': (1.150, 0.932), 'Arial': (1.150, 0.940), 'Calibri': (1.2207, 0.952),
    'Calibri Light': (1.2207, 0.952), 'Cambria': (1.1719, 0.952), 'Georgia': (1.1362, 0.920),
    'Verdana': (1.2153, 1.008), 'Tahoma': (1.2075, 1.004), 'Segoe UI': (1.3301, 1.082),
    'Courier New': (1.1328, 0.832), 'Book Antiqua': (1.2400, 0.962), 'Garamond': (1.1250, 0.866),
    'Century Gothic': (1.2246, 1.007),
}
LINE_FACTOR = {k: v[0] for k, v in WORD_METRICS.items()}
# metrics read from the fonts embedded in the PDF being converted (per request)
_DOC_METRICS = contextvars.ContextVar('fq_doc_metrics', default={})


def _metrics(fam):
    return _DOC_METRICS.get().get(fam) or WORD_METRICS.get(fam)

PS_FAMILY = {
    'timesnewroman': 'Times New Roman', 'timesnewromanps': 'Times New Roman', 'times': 'Times New Roman',
    'timesroman': 'Times New Roman', 'tinos': 'Times New Roman', 'liberationserif': 'Times New Roman',
    'arial': 'Arial', 'arialmt': 'Arial', 'helvetica': 'Arial', 'arimo': 'Arial', 'liberationsans': 'Arial',
    'arialnarrow': 'Arial Narrow', 'arialblack': 'Arial Black', 'arialunicodems': 'Arial Unicode MS',
    'couriernew': 'Courier New', 'couriernewps': 'Courier New', 'courier': 'Courier New', 'cousine': 'Courier New',
    'liberationmono': 'Courier New',
    'calibri': 'Calibri', 'carlito': 'Calibri', 'calibrilight': 'Calibri Light',
    'cambria': 'Cambria', 'caladea': 'Cambria', 'cambriamath': 'Cambria Math',
    'georgia': 'Georgia', 'verdana': 'Verdana', 'tahoma': 'Tahoma', 'segoeui': 'Segoe UI',
    'garamond': 'Garamond', 'bookantiqua': 'Book Antiqua', 'centurygothic': 'Century Gothic',
    'trebuchetms': 'Trebuchet MS', 'comicsansms': 'Comic Sans MS', 'palatinolinotype': 'Palatino Linotype',
    'bookmanoldstyle': 'Bookman Old Style', 'franklingothicmedium': 'Franklin Gothic Medium',
    'symbol': 'Symbol', 'symbolmt': 'Symbol', 'wingdings': 'Wingdings', 'wingdingsregular': 'Wingdings',
    'mangal': 'Mangal', 'nirmalaui': 'Nirmala UI', 'kokila': 'Kokila', 'aparajita': 'Aparajita',
    'tunga': 'Tunga', 'latha': 'Latha', 'gautami': 'Gautami', 'kartika': 'Kartika', 'vrinda': 'Vrinda',
    'shruti': 'Shruti', 'raavi': 'Raavi', 'aptos': 'Aptos', 'lato': 'Lato', 'roboto': 'Roboto',
    'opensans': 'Open Sans', 'montserrat': 'Montserrat', 'poppins': 'Poppins', 'sourcesanspro': 'Source Sans Pro',
    'dejavusans': 'DejaVu Sans', 'dejavuserif': 'DejaVu Serif', 'notosans': 'Noto Sans', 'notoserif': 'Noto Serif',
    'bahnschrift': 'Bahnschrift', 'candara': 'Candara', 'constantia': 'Constantia', 'corbel': 'Corbel',
    'consolas': 'Consolas', 'lucidaconsole': 'Lucida Console', 'lucidasans': 'Lucida Sans',
    'microsoftsansserif': 'Microsoft Sans Serif', 'msmincho': 'MS Mincho', 'simsun': 'SimSun',
}
STYLE_WORDS = ('bolditalic', 'boldoblique', 'semibold', 'demibold', 'extrabold', 'ultrabold', 'black', 'heavy',
               'bold', 'italic', 'oblique', 'regular', 'roman', 'medium', 'light', 'book', 'normal',
               'condensed', 'narrow', 'psmt', 'ps', 'mt', 'bd', 'it', 'bi')


def font_info(raw: str):
    """PDF font name -> (family, bold, italic)."""
    name = raw.split('+', 1)[-1] if re.match(r'^[A-Z]{6}\+', raw or '') else (raw or '')
    low = name.lower()
    bold = bool(re.search(r'bold|black|heavy|semibold|demi|extrabold', low))
    italic = bool(re.search(r'italic|oblique|-it$|,it$', low))
    base = re.split(r'[-,]', name, 1)[0]
    key = re.sub(r'[^a-z]', '', base.lower())
    if key in PS_FAMILY:
        return PS_FAMILY[key], bold, italic
    k2 = key
    for w in STYLE_WORDS:
        if k2.endswith(w) and len(k2) > len(w) + 2:
            k2 = k2[: -len(w)]
            if k2 in PS_FAMILY:
                return PS_FAMILY[k2], bold, italic
    if k2 in PS_FAMILY:
        return PS_FAMILY[k2], bold, italic
    # Unknown: split CamelCase "OpenSans" -> "Open Sans", drop trailing style words.
    fam = re.sub(r'(PS)?MT$', '', base)
    fam = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', fam).strip() or 'Calibri'
    return fam, bold, italic


# Private-use glyphs of Symbol / Wingdings bullets -> plain Unicode
PUA_MAP = {
    '': '•', '': '▪', '': '➢', '': '✓', '': '❖',
    '': '■', '': '□', '': '□', '': '➔', '': '⇒',
    '': '-', '': '—', '': '●', '': '≥', '': '≤',
    '': '×', '': '÷', '': '→', '': '←', '': '⇒',
    '': '◊', '': '▢', '': '□', '': '◆', '': '►',
}
LIGS = {'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st'}
BULLETS = set('•●◦▪■□‣⁃∙·➢✓✔❖◆►➔⇒◊▢→➤▶★☆♦o*-–—')
NUM_RE = re.compile(r'^(\(?(\d{1,3}|[a-zA-Z]|[ivxlcIVXLC]{1,6})[.)]|\d{1,3}(\.\d{1,3}){1,4}\.?|[①-⑳])$')
XML_BAD = re.compile('[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]')


def clean_text(t: str) -> str:
    for a, b in LIGS.items():
        t = t.replace(a, b)
    for a, b in PUA_MAP.items():
        t = t.replace(a, b)
    return XML_BAD.sub('', t)


# ----------------------------------------------------------------------------
# model
# ----------------------------------------------------------------------------

@dataclass
class Span:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    base: float
    size: float
    font: str
    bold: bool
    italic: bool
    color: str
    sup: bool = False
    sub: bool = False
    underline: bool = False
    strike: bool = False
    shade: str | None = None
    link: str | None = None
    chars: list = field(default_factory=list)   # [(c, x0, x1)]
    raw_font: str | None = None    # Symbol / Wingdings when the glyph came from one
    track: float = 0.0             # extra letter spacing (pt) that makes the line as wide as in the PDF
    tsize: float = 0.0             # the size in the PDF before rounding to Word's half points


@dataclass
class Line:
    spans: list
    x0: float
    x1: float
    y0: float
    y1: float
    base: float
    size: float

    @property
    def text(self):
        return ''.join(s.text for s in self.spans)


@dataclass
class Para:
    lines: list
    kind: str = 'p'          # p | list
    align: str = 'left'
    left: float = 0          # pt, relative to the column/cell left
    first: float = 0         # first-line indent (negative = hanging)
    right: float = 0
    before: float = 0
    pitch: float = 0         # baseline-to-baseline inside the paragraph
    marker: str | None = None   # the list marker text (Unicode)
    marker_raw: tuple | None = None  # (glyph, font) when it is a Symbol/Wingdings bullet
    page_break: bool = False
    tabs: list = field(default_factory=list)   # [(pos_pt, 'left'|'right')]
    border: tuple | None = None   # bottom rule under the paragraph: (color, width, gap)
    empty: bool = False           # a bare horizontal rule (no text)
    rule_y: float = 0


@dataclass
class Table:
    x0: float
    y0: float
    x1: float
    y1: float
    cols: list               # column x boundaries
    rows: list               # row y boundaries
    cells: list              # dicts: r, c, rs, cs, bbox, paras, borders, shade, valign
    before: float = 0
    page_break: bool = False


@dataclass
class Image:
    x0: float
    y0: float
    x1: float
    y1: float
    data: bytes
    ext: str
    before: float = 0
    page_break: bool = False


@dataclass
class ColBreak:
    pass


@dataclass
class Section:
    """a run of blocks with one column layout"""
    cols: int
    blocks: list
    gap: float = 36
    widths: list | None = None


# ----------------------------------------------------------------------------
# extraction
# ----------------------------------------------------------------------------

def _hex(c):
    if isinstance(c, int):
        return '%06X' % c
    if isinstance(c, (tuple, list)) and len(c) >= 3:
        return '%02X%02X%02X' % tuple(max(0, min(255, round(v * 255))) for v in c[:3])
    return '000000'


def _text_turn(page):
    """0, or the rotation that makes mostly-vertical text read left to right."""
    try:
        d = page.get_text('dict')
    except Exception:  # noqa: BLE001
        return 0
    horiz = up = down = 0
    for b in d['blocks']:
        for ln in b.get('lines', []):
            n = sum(len(sp['text'].strip()) for sp in ln['spans'])
            dx, dy = ln.get('dir', (1, 0))
            if abs(dy) < 0.05 and dx > 0:
                horiz += n
            elif dy < -0.9:
                up += n
            elif dy > 0.9:
                down += n
    if max(up, down) > 2 * horiz and max(up, down) > 20:
        return 90 if up > down else 270
    return 0


def extract_spans(page, fontbook=None):
    flags = pymupdf.TEXT_PRESERVE_LIGATURES | pymupdf.TEXT_PRESERVE_WHITESPACE | pymupdf.TEXT_MEDIABOX_CLIP
    raw = page.get_text('rawdict', flags=flags)
    out = []
    for b in raw['blocks']:
        if b.get('type') != 0:
            continue
        for ln in b['lines']:
            d = ln.get('dir', (1, 0))
            if abs(d[1]) > 0.05 or d[0] < 0:     # rotated / vertical text (watermarks, side labels)
                continue
            for s in ln['spans']:
                chars = s.get('chars') or []
                if not chars:
                    continue
                txt = ''.join(ch['c'] for ch in chars)
                if not txt.strip():
                    continue
                # the embedded font's own family name is what Word calls it
                look = fontbook.lookup(s['font']) if fontbook else None
                fam, b_, i_ = look if look else font_info(s['font'])
                fl = s['flags']
                bold = b_ or bool(fl & 16)
                italic = i_ or bool(fl & 2)
                # Symbol / Wingdings glyphs are drawn in the body font once mapped to
                # Unicode — except a list bullet, which keeps Word's own glyph
                raw_font = None
                if fam in ('Symbol', 'Wingdings') and all((ch['c'] in PUA_MAP) or ch['c'].isspace() for ch in chars):
                    raw_font, fam = fam, None
                elif fam == 'OpenSymbol':
                    fam = None     # LibreOffice's bullet font: plain Unicode bullets, body font
                sb = s['bbox']
                # Word sizes go in half points; a scaled PDF (12.19pt…) gets the
                # nearest one plus a hair of letter spacing so lines stay as wide
                size_hp, track = round(s['size'] * 2) / 2, 0.0
                if abs(s['size'] - size_hp) >= 0.05:
                    em = (fontbook.avg_em(s['font']) if fontbook else None) or 0.5
                    if abs(s['size'] - size_hp) * em >= 0.03:
                        track = (s['size'] - size_hp) * em
                # Word slants a font that has no italic (Tahoma, Verdana …) and the PDF
                # keeps slanted and upright words in one span: the slant only shows as
                # a letter's box running into the next one, so decide letter by letter
                slant = [italic] * len(chars)
                over = [None] * len(chars)
                if not italic:
                    lim = 0.08 * s['size']
                    for k in range(len(chars)):
                        c = chars[k]
                        if c['c'].isspace():
                            slant[k] = None
                            continue
                        j = k + 1
                        if j < len(chars) and not chars[j]['c'].isspace():
                            over[k] = (c['bbox'][2] - c['bbox'][0]) - (chars[j]['origin'][0] - c['origin'][0])
                            slant[k] = over[k] > lim
                        else:
                            slant[k] = None      # decided by its neighbours below
                    last = None
                    for k in range(len(chars)):
                        if slant[k] is None:
                            slant[k] = last
                        else:
                            last = slant[k]
                    nxt = None
                    for k in range(len(chars) - 1, -1, -1):
                        if slant[k] is None:
                            slant[k] = nxt if nxt is not None else False
                        else:
                            nxt = slant[k]
                    # a word is italic or not as a whole: smooth single-letter flips
                    for k in range(1, len(chars) - 1):
                        if slant[k - 1] == slant[k + 1] != slant[k] and not chars[k]['c'].isspace():
                            slant[k] = slant[k - 1]
                groups = []
                for k, c in enumerate(chars):
                    it = bool(slant[k])
                    if groups and (groups[-1][0] == it or c['c'].isspace()):
                        groups[-1][1].append(c)
                        groups[-1][2].append(over[k])
                    else:
                        groups.append([it, [c], [over[k]]])
                for it, gch, govs in groups:
                    gtxt = ''.join(c['c'] for c in gch)
                    if not gtxt.strip():
                        if out:
                            out[-1].text += gtxt
                            out[-1].chars += [(c['c'], c['bbox'][0], c['bbox'][2]) for c in gch]
                        continue
                    cl = [(c['c'], c['bbox'][0], c['bbox'][2]) for c in gch]
                    if it and not italic:
                        # a slanted letter's box leans past its real width: measure
                        # from the pen position instead, so line ends stay true
                        ovs = [v for v in govs if v is not None and v > 0]
                        ov = statistics.median(ovs) if ovs else 0.0
                        cl = [(c['c'], c['origin'][0], c['bbox'][2] - ov) for c in gch]
                    # horizontal extent of the ink only — a trailing space would make
                    # every line (and so the page's text width) look one space wider
                    ink = [(a, b) for c, a, b in cl if not c.isspace()]
                    out.append(Span(
                        text=gtxt, x0=ink[0][0], y0=sb[1], x1=ink[-1][1], y1=sb[3], base=s['origin'][1],
                        size=size_hp, font=fam, bold=bold, italic=it, track=track, tsize=s['size'],
                        color=_hex(s.get('color', 0)), sup=bool(fl & 1), chars=cl, raw_font=raw_font,
                    ))
    return out


def group_lines(spans, tol_ratio=0.35):
    """spans -> visual lines (same baseline), left to right."""
    spans = sorted(spans, key=lambda s: (round(s.base, 1), s.x0))
    lines = []
    for s in spans:
        placed = None
        for ln in reversed(lines[-6:]):
            tol = max(1.5, tol_ratio * min(ln.size, s.size))
            if abs(ln.base - s.base) <= tol or (s.y0 >= ln.y0 - 0.5 and s.y1 <= ln.y1 + 0.5 and s.size < ln.size * 0.8):
                placed = ln
                break
        if placed is None:
            lines.append(Line([s], s.x0, s.x1, s.y0, s.y1, s.base, s.size))
        else:
            placed.spans.append(s)
            placed.x0 = min(placed.x0, s.x0)
            placed.x1 = max(placed.x1, s.x1)
            placed.y0 = min(placed.y0, s.y0)
            placed.y1 = max(placed.y1, s.y1)
            if s.size > placed.size:
                placed.size = s.size
    # a raised / lowered small piece (superscript "st", subscript "2") lands
    # in a "line" of its own: put it back into the line it belongs to
    small = [l for l in lines if len(l.text.strip()) <= 8]
    for sl in small:
        host = None
        for ln in lines:
            if ln is sl or ln.size < sl.size / 0.8 or not ln.spans:
                continue
            if ln.base - ln.size * 0.75 <= sl.base <= ln.base + ln.size * 0.4 and                     ln.x0 - 2 <= sl.x0 <= ln.x1 + ln.size * 1.5:
                host = ln
                break
        if host is not None:
            host.spans += sl.spans
            host.x0, host.x1 = min(host.x0, sl.x0), max(host.x1, sl.x1)
            host.y0, host.y1 = min(host.y0, sl.y0), max(host.y1, sl.y1)
            sl.spans = []
    lines = [l for l in lines if l.spans]
    for ln in lines:
        ln.spans.sort(key=lambda s: s.x0)
        # superscript / subscript: smaller span raised / lowered against the line
        for s in ln.spans:
            if s.size < ln.size * 0.85 and len(s.text.strip()) <= 6:
                if s.base < ln.base - ln.size * 0.15:
                    s.sup = True
                elif s.base > ln.base + ln.size * 0.05:
                    s.sub = True
            else:
                s.sup = s.sup and s.size < ln.size * 0.9
        main = [s for s in ln.spans if not (s.sup or s.sub)] or ln.spans
        ln.base = statistics.median(s.base for s in main)
        ln.size = max(s.size for s in main)
    lines.sort(key=lambda l: (l.base, l.x0))
    return lines


def make_line(spans):
    spans = sorted(spans, key=lambda s: s.x0)
    main = [s for s in spans if not (s.sup or s.sub)] or spans
    return Line(spans, min(s.x0 for s in spans), max(s.x1 for s in spans), min(s.y0 for s in spans),
                max(s.y1 for s in spans), statistics.median(s.base for s in main), max(s.size for s in main))


def split_segments(line, gap_em=1.6):
    """Pieces of a line separated by a wide gap (tab, gutter). -> [(x0, x1, [spans])]"""
    segs = []
    for s in line.spans:
        # split a span internally on wide gaps between characters
        pieces = []
        cur = []
        last_x1 = None
        for c, a, b in s.chars:
            if c.isspace():
                cur.append((c, a, b))
                continue
            if last_x1 is not None and a - last_x1 > gap_em * s.size and cur:
                pieces.append(cur)
                cur = []
            cur.append((c, a, b))
            last_x1 = b
        if cur:
            pieces.append(cur)
        for p in pieces:
            txt = ''.join(c for c, _, _ in p)
            if not txt.strip():
                continue
            ink = [(a, b) for c, a, b in p if not c.isspace()]
            sp = Span(**{**s.__dict__, 'text': txt, 'chars': p,
                         'x0': ink[0][0], 'x1': ink[-1][1]})
            if segs and sp.x0 - segs[-1][1] <= gap_em * s.size:
                segs[-1][2].append(sp)
                segs[-1][1] = max(segs[-1][1], sp.x1)
            else:
                segs.append([sp.x0, sp.x1, [sp]])
    return segs


# ----------------------------------------------------------------------------
# drawings: rules, boxes
# ----------------------------------------------------------------------------

def bullet_dots(page, spans):
    """Small filled dots/squares just left of a text line are list bullets that
    the PDF drew as shapes (browsers do this) -> synthetic '•' / '▪' spans."""
    out = []
    try:
        drawings = page.get_drawings()
    except Exception:  # noqa: BLE001
        return out
    for d in drawings:
        r = d['rect']
        if d.get('fill') is None or r.width > 7 or r.height > 7 or r.width < 1.5 or abs(r.width - r.height) > 1.2:
            continue
        cy = (r.y0 + r.y1) / 2
        right = [s for s in spans if s.x0 > r.x1 and s.x0 - r.x1 < 3 * s.size
                 and s.y0 <= cy <= s.y1 and s.text.strip()]
        if not right:
            continue
        nxt = min(right, key=lambda s: s.x0)
        if any(s.x1 <= r.x0 + 0.5 and s.x1 > r.x0 - 2 * nxt.size and s.y0 <= cy <= s.y1 for s in spans):
            continue   # text right before it: an inline dot, not a bullet
        curvy = any(it[0] == 'c' for it in d['items'])
        ch = '\u2022' if curvy else '\u25aa'
        w = r.x1 - r.x0
        out.append(Span(text=ch, x0=r.x0, y0=nxt.y0, x1=r.x1, y1=nxt.y1, base=nxt.base, size=nxt.size,
                        font=None, bold=False, italic=False, color=_hex(d.get('fill')),
                        chars=[(ch, r.x0, r.x1), (' ', r.x1, r.x1 + w)]))
    return out


def collect_rects(page):
    """Thin horizontal rules + filled boxes from the vector drawings."""
    hrules, vrules, fills = [], [], []
    try:
        drawings = page.get_drawings()
    except Exception:  # noqa: BLE001
        return hrules, vrules, fills
    for d in drawings:
        fill = d.get('fill')
        color = d.get('color')
        width = d.get('width') or 0
        for it in d['items']:
            op = it[0]
            if op == 're':
                r = it[1]
                if fill is not None and r.height <= 2.2 and r.width > 2:
                    hrules.append((r.x0, r.x1, (r.y0 + r.y1) / 2, _hex(fill), max(0.25, r.height)))
                elif fill is not None and r.width <= 2.2 and r.height > 2:
                    vrules.append((r.y0, r.y1, (r.x0 + r.x1) / 2, _hex(fill), max(0.25, r.width)))
                elif fill is not None and (r.width > 7 or r.height > 7):
                    fills.append((r.x0, r.y0, r.x1, r.y1, _hex(fill)))
                if color is not None and width and fill is None:
                    w = max(0.25, width)
                    hrules += [(r.x0, r.x1, r.y0, _hex(color), w), (r.x0, r.x1, r.y1, _hex(color), w)]
                    vrules += [(r.y0, r.y1, r.x0, _hex(color), w), (r.y0, r.y1, r.x1, _hex(color), w)]
            elif op == 'l':
                p1, p2 = it[1], it[2]
                if color is None:
                    continue
                w = max(0.25, width)
                if abs(p1.y - p2.y) < 0.8:
                    hrules.append((min(p1.x, p2.x), max(p1.x, p2.x), (p1.y + p2.y) / 2, _hex(color), w))
                elif abs(p1.x - p2.x) < 0.8:
                    vrules.append((min(p1.y, p2.y), max(p1.y, p2.y), (p1.x + p2.x) / 2, _hex(color), w))
            elif op == 'qu':
                q = it[1].rect
                if fill is not None and q.height <= 2.2 and q.width > 2:
                    hrules.append((q.x0, q.x1, (q.y0 + q.y1) / 2, _hex(fill), max(0.25, q.height)))
                elif fill is not None and q.width > 2 and q.height > 2:
                    fills.append((q.x0, q.y0, q.x1, q.y1, _hex(fill)))
    return hrules, vrules, fills


def mark_decorations(lines, hrules, fills, tables):
    def in_table(x, y):
        return any(t.x0 - 1 <= x <= t.x1 + 1 and t.y0 - 1 <= y <= t.y1 + 1 for t in tables)

    used = set()
    for ln in lines:
        for s in ln.spans:
            w = s.x1 - s.x0
            if w <= 0:
                continue
            for i, (a, b, y, col, th) in enumerate(hrules):
                if in_table((a + b) / 2, y):
                    continue
                ov = min(b, s.x1) - max(a, s.x0)
                if ov < 0.6 * w and ov < 0.9 * (b - a):
                    continue
                if s.base - 0.5 <= y <= s.base + max(3.5, s.size * 0.3):
                    s.underline = True
                    used.add(i)
                elif s.y0 + (s.y1 - s.y0) * 0.35 <= y <= s.y0 + (s.y1 - s.y0) * 0.75 and th < 1.6:
                    s.strike = True
                    used.add(i)
            for (fx0, fy0, fx1, fy1, col) in fills:
                if col in ('FFFFFF',) or in_table((fx0 + fx1) / 2, (fy0 + fy1) / 2):
                    continue
                if fx0 - 1 <= s.x0 and s.x1 <= fx1 + 1 and fy0 - 2 <= s.y0 and s.y1 <= fy1 + 2 and (fy1 - fy0) < s.size * 3:
                    s.shade = col
    return used


# ----------------------------------------------------------------------------
# tables
# ----------------------------------------------------------------------------

def _cluster(vals, tol=1.5):
    vals = sorted(vals)
    out = []
    for v in vals:
        if out and v - out[-1][-1] <= tol:
            out[-1].append(v)
        else:
            out.append([v])
    return [sum(g) / len(g) for g in out]


def _snap_rules(bounds, rules, lo, hi):
    out = []
    for b in bounds:
        near = [r[2] for r in rules if abs(r[2] - b) <= 2.5 and min(hi, r[1]) - max(lo, r[0]) > 2]
        out.append(min(near, key=lambda x: abs(x - b)) if near else b)
    return _cluster(out, 0.5)


def _idx(bounds, v, tol=2.0):
    best, bd = None, tol
    for i, b in enumerate(bounds):
        if abs(b - v) <= bd:
            best, bd = i, abs(b - v)
    return best


def _prune(bounds, spans, axis, rules, keep_backed=True):
    """Remove grid lines that only come from shading slices: a band narrower
    than 9pt with no text in it is folded into its neighbour."""
    b = list(bounds)
    changed = True
    while changed and len(b) > 2:
        changed = False
        for i in range(len(b) - 1):
            w = b[i + 1] - b[i]
            if w >= 9:
                continue
            lo, hi = b[i], b[i + 1]
            has_text = any(lo < ((s.x0 + s.x1) / 2 if axis == 'x' else (s.y0 + s.y1) / 2) < hi for s in spans)
            if has_text:
                continue
            # drop the inner boundary that has no ruling line along it
            cand = [j for j in (i, i + 1) if 0 < j < len(b) - 1]
            if not cand:
                continue
            def backed(x):
                return any(abs(r[2] - x) < 1.2 for r in rules)
            pick = next((j for j in cand if not backed(b[j])), cand[0])
            del b[pick]
            changed = True
            break
    return b


def detect_tables(page, hrules, vrules, fills, spans=()):
    tables = []
    try:
        found = page.find_tables(strategy='lines')
    except Exception:  # noqa: BLE001
        return tables
    for t in found.tables:
        cells = [c for c in t.cells if c]
        if len(cells) < 2:
            continue
        bb = pymupdf.Rect(t.bbox)
        if bb.width < 20 or bb.height < 8:
            continue
        # grid lines sit on the ruling lines' centres; shading boxes start a
        # hair away from them, so snap each boundary onto a rule when one is near
        cols = _snap_rules(_cluster([c[0] for c in cells] + [c[2] for c in cells], 2.5), vrules, bb.y0, bb.y1)
        rows = _snap_rules(_cluster([c[1] for c in cells] + [c[3] for c in cells], 2.5), hrules, bb.x0, bb.x1)
        inside = [s for s in spans if bb.x0 - 1 <= (s.x0 + s.x1) / 2 <= bb.x1 + 1 and bb.y0 - 1 <= (s.y0 + s.y1) / 2 <= bb.y1 + 1]
        cols = _prune(cols, inside, 'x', vrules)
        rows = _prune(rows, inside, 'y', hrules)
        if len(cols) < 2 or len(rows) < 2:
            continue
        snap = lambda bounds, v: min(range(len(bounds)), key=lambda i: abs(bounds[i] - v))
        tc = []
        seen = {}
        for c in cells:
            ci, ce = snap(cols, c[0]), snap(cols, c[2])
            ri, re_ = snap(rows, c[1]), snap(rows, c[3])
            if ce <= ci or re_ <= ri:
                continue
            if (ri, ci) in seen:
                continue
            box = (cols[ci], rows[ri], cols[ce], rows[re_])
            cell = {'r': ri, 'c': ci, 'rs': re_ - ri, 'cs': ce - ci, 'bbox': box, 'paras': [], 'lines': []}
            for rr in range(ri, re_):
                for cc in range(ci, ce):
                    seen[(rr, cc)] = cell
            tc.append(cell)
        if not tc:
            continue
        tables.append(Table(bb.x0, bb.y0, bb.x1, bb.y1, cols, rows, tc))
    # borders + shading per cell
    for t in tables:
        for c in t.cells:
            x0, y0, x1, y1 = c['bbox']
            c['borders'] = {
                'top': _edge(hrules, x0, x1, y0), 'bottom': _edge(hrules, x0, x1, y1),
                'left': _edge(vrules, y0, y1, x0), 'right': _edge(vrules, y0, y1, x1),
            }
            c['shade'] = None
            for (fx0, fy0, fx1, fy1, col) in fills:
                if col == 'FFFFFF':
                    continue
                ix = max(0, min(x1, fx1) - max(x0, fx0)) * max(0, min(y1, fy1) - max(y0, fy0))
                if ix >= 0.7 * (x1 - x0) * (y1 - y0):
                    c['shade'] = col
    return tables


def _edge(rules, a, b, pos, tol=2.0):
    need = (b - a) * 0.5
    best = None
    cover = 0
    for (r0, r1, p, col, th) in rules:
        if abs(p - pos) > tol + th:
            continue
        ov = min(b, r1) - max(a, r0)
        if ov > 0:
            cover += ov
            if best is None or th > best[1]:
                best = (col, th)
    if cover >= need and best:
        return best
    return None


# ----------------------------------------------------------------------------
# images
# ----------------------------------------------------------------------------

def extract_images(doc, page, text_lines):
    out = []
    try:
        infos = page.get_image_info(xrefs=True)
    except Exception:  # noqa: BLE001
        return out
    pr = page.rect
    for info in infos:
        bb = pymupdf.Rect(info['bbox']) & pr
        if bb.is_empty or bb.width < 6 or bb.height < 6:
            continue
        # a full-page picture with a text layer on top is a scan + OCR text: keep the text only
        if bb.width * bb.height > 0.8 * pr.width * pr.height and len(text_lines) > 5:
            continue
        # a line-high picture sitting on real text is that text drawn as an image
        # (Word does this for some fonts): the text is already there
        over = [l for l in text_lines
                if min(l.x1, bb.x1) - max(l.x0, bb.x0) > 0 and min(l.y1, bb.y1) - max(l.y0, bb.y0) > 0.5 * (l.y1 - l.y0)]
        if over:
            covered = sum(max(0, min(l.x1, bb.x1) - max(l.x0, bb.x0)) for l in over)
            if bb.height <= 2.5 * max(l.size for l in over) and covered >= 0.5 * bb.width:
                continue
        xref = info.get('xref') or 0
        data, ext = None, 'png'
        try:
            if xref:
                pix = pymupdf.Pixmap(doc, xref)
                if pix.n - pix.alpha >= 4:
                    pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                info2 = doc.extract_image(xref)
                smask = info2.get('smask') if info2 else 0
                if info2 and info2.get('ext') in ('jpeg', 'jpg') and not smask and pix.n - pix.alpha == 3:
                    data, ext = info2['image'], 'jpeg'
                else:
                    if smask:
                        try:
                            pix = pymupdf.Pixmap(pix, pymupdf.Pixmap(doc, smask))
                        except Exception:  # noqa: BLE001
                            pass
                    data, ext = pix.tobytes('png'), 'png'
        except Exception:  # noqa: BLE001
            data = None
        if not data:
            try:
                pix = page.get_pixmap(clip=bb, dpi=150)
                data, ext = pix.tobytes('png'), 'png'
            except Exception:  # noqa: BLE001
                continue
        out.append(Image(bb.x0, bb.y0, bb.x1, bb.y1, data, ext))
    return out


# ----------------------------------------------------------------------------
# headers / footers
# ----------------------------------------------------------------------------

def _hf_key(text):
    return re.sub(r'\d+', '#', re.sub(r'\s+', ' ', text.strip().lower()))


def find_running(pages_lines, heights):
    """Lines repeated at the top/bottom of most pages -> {(page, id(line)): 'header'|'footer'}"""
    n = len(pages_lines)
    marks = {}
    if n < 2:
        return marks
    for zone in ('header', 'footer'):
        cnt = Counter()
        per_page = []
        for pi, lines in enumerate(pages_lines):
            h = heights[pi]
            cand = [l for l in lines if (l.y1 < h * 0.12 if zone == 'header' else l.y0 > h * 0.88)]
            keys = {(_hf_key(l.text), round(l.x0 / 8)) for l in cand}
            per_page.append((cand, keys))
            for k in keys:
                cnt[k] += 1
        need = max(2, math.ceil(n * 0.5))
        rep = {k for k, v in cnt.items() if v >= need}
        # a bare page number moves left/right on odd/even pages — match by text only
        cnt2 = Counter()
        for cand, _ in per_page:
            for k in {_hf_key(l.text) for l in cand}:
                cnt2[k] += 1
        rep_txt = {k for k, v in cnt2.items() if v >= need}
        for pi, (cand, _) in enumerate(per_page):
            for l in cand:
                k = (_hf_key(l.text), round(l.x0 / 8))
                if k in rep or _hf_key(l.text) in rep_txt:
                    marks[(pi, id(l))] = zone
    return marks


# ----------------------------------------------------------------------------
# columns
# ----------------------------------------------------------------------------

def find_column_runs(lines, left, right):
    """Find runs of lines laid out in two columns. -> list of (start, end, gutter_x0, gutter_x1)"""
    width = right - left
    if width < 200 or len(lines) < 6:
        return []
    segs = [split_segments(l, gap_em=1.2) for l in lines]
    best = None
    for frac in [i / 100 for i in range(30, 71, 2)]:
        x = left + width * frac
        runs = []
        start = None
        for i, sg in enumerate(segs):
            crosses = any(a < x - 1 and b > x + 1 for a, b, _ in sg)
            if crosses:
                if start is not None:
                    runs.append((start, i))
                start = None
            elif start is None:
                start = i
        if start is not None:
            runs.append((start, len(segs)))
        for a, b in runs:
            L = [s for i in range(a, b) for s in segs[i] if s[1] <= x]
            R = [s for i in range(a, b) for s in segs[i] if s[0] >= x]
            if len(L) < 3 or len(R) < 3:
                continue
            gl = max(s[1] for s in L)
            gr = min(s[0] for s in R)
            if gr - gl < 8:
                continue
            # both columns must be real text: long pieces, most of the run's height
            lw = statistics.median(s[1] - s[0] for s in L)
            rw = statistics.median(s[1] - s[0] for s in R)
            if lw < 0.25 * width or rw < 0.25 * width:
                continue
            ly = [lines[i].base for i in range(a, b) if any(s[1] <= x for s in segs[i])]
            ry = [lines[i].base for i in range(a, b) if any(s[0] >= x for s in segs[i])]
            span_y = lines[b - 1].base - lines[a].base + 1
            if (max(ly) - min(ly)) < 0.4 * span_y or (max(ry) - min(ry)) < 0.3 * span_y:
                continue
            score = b - a
            if best is None or score > best[0]:
                best = (score, a, b, gl, gr)
    if not best:
        return []
    _, a, b, gl, gr = best
    return [(a, b, gl, gr)]


# ----------------------------------------------------------------------------
# paragraphs
# ----------------------------------------------------------------------------

def _space_w(s: Span):
    for c, a, b in s.chars:
        if c == ' ' and b > a:
            return b - a
    return s.size * 0.25


def _first_word_w(line: Line):
    w = 0
    started = False
    for s in line.spans:
        for c, a, b in s.chars:
            if c.isspace():
                if started:
                    return w
                continue
            if not started:
                started = True
                w0 = a
            w = b - w0
    return w


def _marker(line: Line):
    """(marker, marker x, text-start x, raw glyph) when the line starts with a list marker."""
    first = line.spans[0]
    # first token of the line
    tok = ''
    tok_end = None
    for c, a, b in first.chars:
        if c.isspace():
            if tok:
                break
            continue
        tok += c
        tok_end = b
    if not tok:
        return None
    tokc = clean_text(tok)
    is_bullet = len(tokc) == 1 and (tokc in BULLETS or tokc in '\u25aa\u2022')
    is_num = bool(NUM_RE.match(tokc))
    if not (is_bullet or is_num):
        return None
    # where does the text after the marker start?
    nxt = None
    seen_tok = False
    for s in line.spans:
        for c, a, b in s.chars:
            if not seen_tok:
                if c.isspace():
                    continue
                if b >= tok_end - 0.01:
                    seen_tok = True
                continue
            if not c.isspace():
                nxt = a
                break
        if nxt is not None:
            break
    if nxt is None:
        return None
    gap = nxt - tok_end
    sw = _space_w(first)
    if is_bullet and tokc in '-*o–—' and gap < sw * 1.8:
        return None                       # a dash in running text
    if is_num and gap < sw * 1.8 and not tokc.endswith(')'):
        return None                       # "1. The ..." written with a plain space: keep as text
    raw = (tok, first.raw_font) if first.raw_font and len(tok) == 1 else None
    return tokc, line.x0, nxt, raw


def _room_fits(cur, prev, ln, right):
    room = (right - cur.right) - prev.x1
    return _first_word_w(ln) + _space_w(prev.spans[-1]) < room - 1.0


def build_paras(lines, left, right, page_top=None):
    """Lines of one column (y order) -> Para list. left/right: column edges."""
    paras = []
    cur = None
    width = right - left
    # the usual baseline step inside a paragraph, per text size: most
    # neighbouring lines belong to the same paragraph, so it is the most
    # common step. A clearly bigger one is a paragraph break even after a
    # full line (1.5 / double spaced text has a bigger usual step itself).
    steps = defaultdict(Counter)
    for a, b in zip(lines, lines[1:]):
        if abs(a.size - b.size) <= 0.5 and 0.9 * a.size <= b.base - a.base <= 3.2 * a.size:
            steps[round(a.size * 2) / 2][round((b.base - a.base) * 2) / 2] += 1
    usual = {}
    for sz, c in steps.items():
        step, n = c.most_common(1)[0]
        if n >= 3 and n >= 0.4 * sum(c.values()):
            usual[sz] = step
    for ln in lines:
        mk = _marker(ln)
        start_new = cur is None
        if cur is not None:
            prev = cur.lines[-1]
            pitch = ln.base - prev.base
            exp = cur.pitch or prev.size * 1.25
            if cur.pitch:
                gap_big = pitch > exp * 1.22 + 0.5
            else:
                # 2nd line: 1.5 / double spacing looks like a paragraph gap, so a
                # full first line (Word had to wrap it) may sit further away
                step = usual.get(round(prev.size * 2) / 2)
                if step:
                    gap_big = pitch > step * 1.25 + 0.5
                else:
                    gap_big = pitch > prev.size * (3.0 if not _room_fits(cur, prev, ln, right) else 1.75)
                # an ambiguous gap followed by a line that opens with a bold label
                # in another font ("Tahoma: …") starts a new paragraph
                if not gap_big and pitch > prev.size * 1.6:
                    f0 = ln.spans[0]
                    if f0.bold and f0.font != prev.spans[-1].font:
                        gap_big = True
            size_change = abs(ln.size - prev.size) > 1.2
            style_change = (all(s.bold for s in ln.spans) != all(s.bold for s in prev.spans)) and len(cur.lines) == 1
            # Word's wrap rule: if the next line's first word would have fitted, the line ended on purpose
            room = (right - cur.right) - prev.x1
            fw = _first_word_w(ln)
            fits = fw + _space_w(prev.spans[-1]) < room - 1.0
            centered_run = cur.align == 'center'
            cont_x = cur.lines[1].x0 if len(cur.lines) > 1 else None
            indent_break = cont_x is not None and abs(ln.x0 - cont_x) > 2.5
            if cur.kind == 'list':
                text_x = cur.left + left
                indent_break = abs(ln.x0 - text_x) > 2.5
            elif len(cur.lines) == 1 and not centered_run:
                # 2nd line: allowed to start left of the first (first-line indent) or level with it
                indent_break = ln.x0 > cur.lines[0].x0 + 2.5
            if mk or gap_big or size_change or style_change or indent_break or ln.base < prev.base:
                start_new = True
            elif fits and not centered_run:
                start_new = True
            elif centered_run and abs(((ln.x0 + ln.x1) / 2) - (left + right) / 2) > 3:
                start_new = True
        if start_new:
            if cur:
                paras.append(cur)
            cur = Para([ln])
            if mk:
                tok, mx, tx, raw = mk
                cur.kind = 'list'
                cur.marker = tok
                cur.marker_raw = raw
                cur.left = tx - left
                cur.first = -(tx - mx)
            else:
                cur.left = ln.x0 - left
            # single centred / right lines are decided now so the wrap test uses the right edge
            c = (ln.x0 + ln.x1) / 2
            if not mk and ln.x0 > left + 12 and ln.x1 < right - 12 and abs(c - (left + right) / 2) < max(3, width * 0.01):
                cur.align = 'center'
            elif not mk and ln.x0 > left + width * 0.3 and abs(ln.x1 - right) < 3:
                cur.align = 'right'
        else:
            if len(cur.lines) == 1:
                cur.pitch = ln.base - cur.lines[0].base
            cur.lines.append(ln)
    if cur:
        paras.append(cur)
    paras = _merge_centred(paras)
    for p in paras:
        finish_para(p, left, right)
    return paras


def _merge_centred(paras):
    """A centred block may be centred on its own axis (not the page's):
    its lines come out as one-line paragraphs with ragged starts. Rejoin
    runs of them into one centred paragraph."""
    out = []
    i = 0
    while i < len(paras):
        j = i
        run = [paras[i]]
        while j + 1 < len(paras):
            a, b = run[-1], paras[j + 1]
            if len(a.lines) != 1 or len(b.lines) != 1 or a.kind == 'list' or b.kind == 'list':
                break
            la, lb = a.lines[0], b.lines[0]
            pitch = lb.base - la.base
            if abs(la.size - lb.size) > 0.6 or not (0.9 * la.size <= pitch <= 1.7 * la.size):
                break
            if all(s.bold for s in la.spans) != all(s.bold for s in lb.spans):
                break
            run.append(b)
            j += 1
        if len(run) >= 2:
            ls = [q.lines[0] for q in run]
            cents = [(l.x0 + l.x1) / 2 for l in ls]
            mc = statistics.median(cents)
            box = max(l.x1 - l.x0 for l in ls) + 1.6
            # each line must be "full": the next line's first word would not have fitted
            wrapped = all((a.x1 - a.x0) + _space_w(a.spans[-1]) + _first_word_w(b) > box
                          for a, b in zip(ls, ls[1:]))
            if wrapped and max(abs(c - mc) for c in cents) <= 10 and max(l.x0 for l in ls) - min(l.x0 for l in ls) > 15:
                np_ = Para(ls)
                np_.align = 'center'
                np_.centre = mc
                out.append(np_)
                i = j + 1
                continue
        out.append(paras[i])
        i += 1
    return out

# a font's own space, in em — to tell a stretched (justified) line from a ragged one
SPACE_EM = {'Times New Roman': 0.25, 'Arial': 0.278, 'Calibri': 0.226, 'Cambria': 0.22, 'Georgia': 0.241,
            'Verdana': 0.352, 'Tahoma': 0.313, 'Segoe UI': 0.274, 'Garamond': 0.25, 'Book Antiqua': 0.25,
            'Century Gothic': 0.277, 'Courier New': 0.6, 'Calibri Light': 0.226}


def space_ratios(line):
    """word gap per space ÷ the font's own space width, for each gap in the
    line. A PDF keeps the space glyph at its normal width; justification
    shows up only in where the next word starts — measured pen to pen
    (from the first space to the next word), which slanted letters can't skew."""
    out = []
    sp_x = None
    nsp = 0
    em_size = None
    for s in line.spans:
        em = SPACE_EM.get(s.font)
        for c, a, b in s.chars:
            if c == ' ':
                if sp_x is None:
                    sp_x = a
                    em_size = em * s.size if em else None
                nsp += 1
                continue
            if sp_x is not None and nsp and em_size:
                out.append((a - sp_x) / nsp / em_size)
            sp_x = None
            nsp = 0
    return out


def _stretched(line):
    r = space_ratios(line)
    return len(r) >= 3 and statistics.median(r) > 1.06


def _is_justified(body, ends, right):
    if not body or max(ends) - min(ends) > 1.2:
        return False
    if len(body) >= 2:
        return True
    return abs(max(ends) - right) <= 4 and _stretched(body[0])


def finish_para(p: Para, left, right):
    ls = p.lines
    if len(ls) >= 2:
        pitches = [b.base - a.base for a, b in zip(ls, ls[1:])]
        p.pitch = statistics.median(pitches)
    if p.kind != 'list':
        if len(ls) >= 2:
            cont = statistics.median(l.x0 for l in ls[1:])
            p.left = cont - left
            p.first = ls[0].x0 - cont
        else:
            p.left = ls[0].x0 - left
            p.first = 0
    if getattr(p, 'centre', None) is not None:
        # centred on its own axis: a box around that axis just wide enough
        half = max(max(p.centre - l.x0, l.x1 - p.centre) for l in ls) + 0.8
        p.left, p.first = p.centre - half - left, 0
        p.right = right - (p.centre + half)
        p.pitch = statistics.median(b.base - a.base for a, b in zip(ls, ls[1:]))
        return
    if p.align in ('center', 'right') and len(ls) == 1:
        p.left, p.first = 0, 0
    elif len(ls) >= 2:
        body = ls[:-1]
        ends = [l.x1 for l in body]
        cent = [((l.x0 + l.x1) / 2) for l in ls]
        mid = (left + right) / 2
        if _is_justified(body, ends, right):
            p.align = 'both'
        elif all(abs(c - mid) < 3 for c in cent) and min(l.x0 for l in ls) > left + 8:
            p.align = 'center'
            p.left, p.first = 0, 0
        elif all(abs(l.x1 - right) < 3 for l in ls) and min(l.x0 for l in ls) > left + 20:
            p.align = 'right'
            p.left, p.first = 0, 0
        else:
            p.align = 'left'
        if p.align == 'both' and abs(right - max(ends)) > 0.5:
            p.right = right - max(ends)          # may be negative: wider than the page text
    if p.align == 'left' and max(l.x1 for l in ls) > right + 0.5:
        p.right = right - max(l.x1 for l in ls) - 0.5
    # in-line tab stops (wide gaps inside a line), e.g. "Title<tab>Date"
    tabs = []
    for l in ls:
        segs = split_segments(l, gap_em=1.6)
        for sg in segs[1:]:
            pos = sg[0] - left
            kind = 'left'
            if abs(sg[1] - right) < 3 and sg is segs[-1]:
                pos, kind = right - left, 'right'
            tabs.append((round(pos, 1), kind))
    if tabs:
        dedup = {}
        for pos, kind in tabs:
            dedup[round(pos)] = (pos, kind)
        p.tabs = sorted(dedup.values())


# ----------------------------------------------------------------------------
# page layout -> blocks
# ----------------------------------------------------------------------------

@dataclass
class PageOut:
    width: float
    height: float
    sections: list
    header: list
    footer: list


def layout_page(doc, page, pi, all_lines, running, margins, tables, images, hrules, fills, rule_used=frozenset()):
    L, R = margins['left'], margins['right']
    body = [l for l in all_lines if (pi, id(l)) not in running]
    hdr = [l for l in all_lines if running.get((pi, id(l))) == 'header']
    ftr = [l for l in all_lines if running.get((pi, id(l))) == 'footer']

    # text inside tables goes to the cells
    free = []
    for l in body:
        cy = (l.y0 + l.y1) / 2
        t = next((t for t in tables if t.x0 - 1 <= (l.x0 + l.x1) / 2 <= t.x1 + 1 and t.y0 - 1 <= cy <= t.y1 + 1), None)
        if t is None:
            free.append(l)
            continue
        # a line can straddle several cells: give each span to its cell
        for s in l.spans:
            sx = (s.x0 + s.x1) / 2
            c = next((c for c in t.cells if c['bbox'][0] - 1 <= sx <= c['bbox'][2] + 1 and c['bbox'][1] - 1 <= cy <= c['bbox'][3] + 1), None)
            if c is not None:
                c.setdefault('spans', []).append(s)
    for t in tables:
        insets = []
        for c in t.cells:
            ls0 = c.get('spans', [])
            if ls0:
                insets.append(min(s.x0 for s in ls0) - c['bbox'][0])
        # Word's default cell margin is 5.4pt; a web/LibreOffice table may use less
        mi = min(insets) if insets else 5.4
        t.pad = 5.4 if mi >= 4.4 else max(0.0, mi - 0.3)
        for c in t.cells:
            ls = group_lines(c.get('spans', []))
            x0, y0, x1, y1 = c['bbox']
            pad = t.pad
            c['paras'] = build_paras(ls, x0 + pad, x1 - pad) if ls else []
            c['valign'] = 'top'
            if ls:
                ty0, ty1 = ls[0].y0, ls[-1].y1
                if (y1 - y0) > (ty1 - ty0) * 1.6 + 6:
                    if abs(((ty0 + ty1) / 2) - ((y0 + y1) / 2)) < 2:
                        c['valign'] = 'center'
                    elif abs(ty1 - (y1 - 2)) < 3:
                        c['valign'] = 'bottom'

    # columns
    blocks = []      # (y, kind, obj)
    runs = find_column_runs(free, L, R)
    used = set()
    sections_spec = []
    if runs:
        a, b, gl, gr = runs[0]
        col_lines = free[a:b]
        mid = (gl + gr) / 2
        leftc, rightc = [], []
        for l in col_lines:
            # side-by-side columns share baselines, so one visual "line" may
            # hold a piece of each column: cut it at the gutter
            lp = [s_ for s_ in l.spans if (s_.x0 + s_.x1) / 2 < mid]
            rp = [s_ for s_ in l.spans if (s_.x0 + s_.x1) / 2 >= mid]
            if lp:
                leftc.append(make_line(lp))
            if rp:
                rightc.append(make_line(rp))
        leftc.sort(key=lambda l: l.base)
        rightc.sort(key=lambda l: l.base)
        used = {id(l) for l in col_lines}
        sections_spec.append((free[a].y0 - 0.1, free[b - 1].y1 + 0.1, leftc, rightc, gl, gr))

    single = [l for l in free if id(l) not in used]
    paras = build_paras(single, L, R)
    for p in paras:
        blocks.append((p.lines[0].y0, 'p', p))
    # horizontal rules that are not underlines or table borders: under a
    # paragraph -> its bottom border; on their own -> an empty ruled paragraph
    for i, (a, b, y, col, th) in enumerate(hrules):
        if i in rule_used or b - a < 0.25 * (R - L):
            continue
        if any(t.x0 - 2 <= (a + b) / 2 <= t.x1 + 2 and t.y0 - 2 <= y <= t.y1 + 2 for t in tables):
            continue
        if any(abs(y - y2) < 0.6 and abs(a - a2) < 1 for (a2, b2, y2, _, _) in hrules[:i]):
            continue
        above = [p for p in paras if p.lines[-1].y1 <= y + 0.5 and y - p.lines[-1].y1 < 12
                 and min(b, R) - max(a, p.lines[0].x0) > 0]
        if above:
            p = max(above, key=lambda q: q.lines[-1].y1)
            if p.border is None:
                p.border = (col, th, max(0, y - p.lines[-1].y1 - th / 2))
                continue
        rp = Para([], empty=True, rule_y=y, border=(col, th, 0))
        rp.left = max(0, a - L)
        rp.right = max(0, R - b)
        blocks.append((y - 1, 'p', rp))
    for t in tables:
        blocks.append((t.y0, 't', t))
    for im in images:
        blocks.append((im.y0, 'i', im))
    blocks.sort(key=lambda b: b[0])

    sections = []
    if not sections_spec:
        sections.append(Section(1, [b[2] for b in blocks]))
    else:
        y0, y1, leftc, rightc, gl, gr = sections_spec[0]
        before = [b[2] for b in blocks if b[0] < y0]
        after = [b[2] for b in blocks if b[0] >= y0]
        if before:
            sections.append(Section(1, before))
        # equal columns whose second one starts where the right text starts;
        # the first must still hold its longest line
        g = 2 * (gr - L) - (R - L)
        wc = gr - L - g
        if g >= 6 and wc >= gl - L - 0.8:
            lp = build_paras(leftc, L, L + wc)
            rp = build_paras(rightc, gr, R)
            sections.append(Section(2, lp + [ColBreak()] + rp, gap=g, widths=None))
        else:
            lp = build_paras(leftc, L, gl)
            rp = build_paras(rightc, gr, R)
            sections.append(Section(2, lp + [ColBreak()] + rp, gap=gr - gl, widths=[gl - L, R - gr]))
        if after:
            sections.append(Section(1, after))

    hp = build_paras(hdr, L, R) if hdr else []
    fp = build_paras(ftr, L, R) if ftr else []
    return PageOut(page.rect.width, page.rect.height, sections, hp, fp)


def compute_margins(pages_lines, running, widths, heights):
    xs0, xs1, ys0, ys1, gaps = [], [], [], [], []
    for pi, lines in enumerate(pages_lines):
        body = [l for l in lines if (pi, id(l)) not in running]
        if not body:
            continue
        xs0 += [l.x0 for l in body]
        xs1 += [l.x1 for l in body]
        ys0.append(min(l.y0 for l in body))
        ys1.append(max(l.y1 for l in body))
        gaps.append(heights[pi] - max(l.y1 for l in body))
    sizes = Counter((round(a), round(b)) for a, b in zip(widths, heights))
    w, h = sizes.most_common(1)[0][0]
    if not xs0:
        return {'left': 72, 'right': w - 72, 'top': 72, 'bottom': h - 72}
    xs0.sort()
    xs1.sort()
    # the left edge most lines start at (robust to a few outdented lines)
    left = Counter(round(x) for x in xs0).most_common(1)[0][0]
    left = min(left, xs0[max(0, len(xs0) // 50)])
    left = max(18, min(left, w / 3))
    # The right margin is somewhere between the longest line's end (every line
    # fitted) and the first place a wrapped line's next word would have fitted
    # (Word wrapped it, so it did not). Any value in between reproduces every
    # line break; prefer the usual page margins inside that window.
    lo = xs1[-1]
    ends = Counter(round(x) for x in xs1)
    edge, n_edge = max(((e, n) for e, n in ends.items() if e >= xs1[-1] - 30), key=lambda t: (t[1], t[0]))
    beyond = sum(1 for x in xs1 if x > edge + 1.5)
    if n_edge >= max(8, 0.15 * len(xs1)) and beyond <= 0.08 * len(xs1):
        # the text edge most (justified) lines stop at; wider paragraphs get a
        # negative right indent instead of widening the whole page
        lo = max(x for x in xs1 if round(x) == edge)
    hi = lo + 72
    for pi, lines in enumerate(pages_lines):
        body = sorted((l for l in lines if (pi, id(l)) not in running), key=lambda l: l.base)
        for a, b in zip(body, body[1:]):
            if b.base - a.base > max(a.size, b.size) * 1.6 or b.base <= a.base:
                continue
            if a.x1 < lo - 90 or b.x0 > a.x0 + 30:
                continue
            fw = _first_word_w(b)
            if fw <= 0:
                continue
            cand = a.x1 + _space_w(a.spans[-1]) + fw
            if cand > lo + 0.3:
                hi = min(hi, cand)
    right = None
    for mg in [left, 72, 70.87, 90, 54, 56.69, 36, 63.78, 85.04, 51.02, 42.52, 28.35, 108]:
        x = w - mg
        if lo - 0.8 <= x < hi - 0.3:
            right = x
            break
    if right is None:
        right = lo + min(1.5, max(0.2, (hi - lo) / 2))
    right = min(w - 9, max(right, w * 2 / 3))
    return {'left': left, 'right': right, 'top': max(18, min(ys0)), 'bottom': min(h - 18, max(ys1)),
            'bottom_gap': max(14, min(gaps))}


# ----------------------------------------------------------------------------
# docx writer
# ----------------------------------------------------------------------------

class Writer:
    def __init__(self):
        self.media = []      # (name, bytes)
        self.rels = []       # (rid, type, target, external)
        self.n = 0
        self.fonts = Counter()

    def rid(self, typ, target, external=False):
        self.n += 1
        r = f'rIdx{self.n}'
        self.rels.append((r, typ, target, external))
        return r

    # ---- runs
    def run(self, s: Span, text=None, base_font='Calibri', raw=False):
        t = text if text is not None else s.text
        t = XML_BAD.sub('', t) if raw else clean_text(t)
        if not t:
            return ''
        font = s.font or base_font
        self.fonts[font] += len(t)
        rpr = [f'<w:rFonts w:ascii="{escape(font)}" w:hAnsi="{escape(font)}" w:cs="{escape(font)}" w:eastAsia="{escape(font)}"/>']
        if s.bold:
            rpr.append('<w:b/><w:bCs/>')
        if s.italic:
            rpr.append('<w:i/><w:iCs/>')
        if s.strike:
            rpr.append('<w:strike/>')
        if s.color and s.color != '000000':
            rpr.append(f'<w:color w:val="{s.color}"/>')
        sz = max(2, round(s.size * 2))
        if s.sup or s.sub:
            sz = max(2, round(s.size * 2 / 0.65)) if s.size < 9 else sz
        rpr.append(f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>')
        if s.underline:
            rpr.append('<w:u w:val="single"/>')
        if s.shade:
            rpr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{s.shade}"/>')
        if s.sup:
            rpr.append('<w:vertAlign w:val="superscript"/>')
        elif s.sub:
            rpr.append('<w:vertAlign w:val="subscript"/>')
        if s.track:
            # letters and spaces need different corrections (a space is narrower)
            sp_em = SPACE_EM.get(s.font or base_font, 0.28)
            tw_l = round(s.track * TW)
            tw_s = round((s.tsize - s.size) * sp_em * TW)
            out = []
            for piece in re.findall(r' +|\t|[^ \t]+', t):
                if piece == '\t':
                    out.append(f'<w:r><w:rPr>{"".join(rpr)}</w:rPr><w:tab/></w:r>')
                    continue
                tw = tw_s if piece.startswith(' ') else tw_l
                r2 = list(rpr)
                if tw:
                    # w:spacing comes right after w:color (or before w:sz) in the rPr sequence
                    at = next((i + 1 for i, x in enumerate(r2) if x.startswith('<w:color')), None)
                    if at is None:
                        at = next(i for i, x in enumerate(r2) if x.startswith('<w:sz'))
                    r2.insert(at, f'<w:spacing w:val="{tw}"/>')
                out.append(f'<w:r><w:rPr>{"".join(r2)}</w:rPr><w:t xml:space="preserve">{escape(piece)}</w:t></w:r>')
            return ''.join(out)
        parts = re.split(r'(\t)', t)
        body = ''.join('<w:tab/>' if p == '\t' else f'<w:t xml:space="preserve">{escape(p)}</w:t>' for p in parts if p)
        return f'<w:r><w:rPr>{"".join(rpr)}</w:rPr>{body}</w:r>'

    def line_runs(self, line: Line, left, skip_marker_until=None, base_font='Calibri', spaces=False):
        """runs for one line; wide gaps become tabs (or spaces in centred text)."""
        out = []
        segs = split_segments(line, gap_em=1.6)
        for si, (sx0, sx1, spans) in enumerate(segs):
            if si > 0:
                if spaces:
                    prev_sp = segs[si - 1][2][-1]
                    n = max(1, round((sx0 - segs[si - 1][1]) / max(0.5, _space_w(prev_sp))))
                    out.append(f'<w:r><w:rPr><w:sz w:val="{max(2, round(prev_sp.size * 2))}"/></w:rPr>'
                               f'<w:t xml:space="preserve">{" " * n}</w:t></w:r>')
                else:
                    out.append('<w:r><w:tab/></w:r>')
            # merge consecutive spans with identical style
            merged = []
            for s in spans:
                txt = s.text
                if skip_marker_until is not None:
                    keep = ''.join(c for c, a, b in s.chars if a >= skip_marker_until - 0.01)
                    if not keep.strip():
                        continue
                    txt = keep.lstrip()
                if si == 0 and not merged:
                    txt = txt.lstrip()
                key = (s.font, s.bold, s.italic, s.color, s.size, s.sup, s.sub, s.underline, s.strike, s.shade, s.link,
                       round(s.track * TW))
                if merged and merged[-1][0] == key:
                    prev_s = merged[-1][2]
                    joiner = '' if (txt.startswith(' ') or merged[-1][1].endswith(' ') or s.x0 - prev_s.x1 < s.size * 0.12) else ' '
                    merged[-1][1] += joiner + txt
                    merged[-1][2] = s
                else:
                    if merged:
                        prev_s = merged[-1][2]
                        if s.x0 - prev_s.x1 > s.size * 0.12 and not merged[-1][1].endswith(' ') and not txt.startswith(' '):
                            merged[-1][1] += ' '
                    merged.append([key, txt, s])
            if si == len(segs) - 1 and merged:
                merged[-1][1] = merged[-1][1].rstrip()
            for key, txt, s in merged:
                if not txt:
                    continue
                if s.link:
                    rid = self.rid('http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', s.link, True)
                    out.append(f'<w:hyperlink r:id="{rid}">{self.run(s, txt, base_font)}</w:hyperlink>')
                else:
                    out.append(self.run(s, txt, base_font))
        return out

    def para(self, p: Para, left, base_font, line_factor, page_break=False, before_pt=None):
        ppr = []
        if page_break:
            ppr.append('<w:pageBreakBefore/>')
        if p.border:
            col, th, gap = p.border
            ppr.append(f'<w:pBdr><w:bottom w:val="single" w:sz="{max(2, min(48, round(th * 8)))}" '
                       f'w:space="{max(0, min(31, round(gap)))}" w:color="{col}"/></w:pBdr>')
        if p.empty:
            before = p.before if before_pt is None else before_pt
            ppr.append(f'<w:spacing w:before="{max(0, round(before * TW))}" w:after="0" w:line="20" w:lineRule="exact"/>')
            ppr.append(f'<w:ind w:left="{round(p.left * TW)}" w:right="{round(p.right * TW)}"/>')
            return f'<w:p><w:pPr>{"".join(ppr)}<w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>'
        if p.tabs and p.align not in ('center', 'right'):
            ppr.append('<w:tabs>' + ''.join(
                f'<w:tab w:val="{k}" w:pos="{max(0, round(pos * TW))}"/>' for pos, k in p.tabs) + '</w:tabs>')
        before = p.before if before_pt is None else before_pt
        rule, val, _, _ = line_model(p, base_font)
        # "at least" the measured baseline pitch lands every line where it was,
        # yet never clips if the user later picks a bigger font
        spacing = (f'w:line="{round(val * TW)}" w:lineRule="{rule}"' if rule != 'auto'
                   else 'w:line="240" w:lineRule="auto"')
        ppr.append(f'<w:spacing w:before="{max(0, round(before * TW))}" w:after="0" {spacing}/>')
        ind_left = round(p.left * TW)
        first = round(p.first * TW)
        ind = f'w:left="{ind_left}"'
        if abs(p.right) > 0.5:
            ind += f' w:right="{round(p.right * TW)}"'
        if first < 0:
            ind += f' w:hanging="{-first}"'
        elif first > 0:
            ind += f' w:firstLine="{first}"'
        ppr.append(f'<w:ind {ind}/>')
        ppr.append(f'<w:jc w:val="{ {"left": "left", "center": "center", "right": "right", "both": "both"}[p.align] }"/>')
        runs = []
        if p.kind == 'list':
            ms = p.lines[0].spans[0]
            mk = Span(**{**ms.__dict__, 'underline': False})
            if p.marker_raw:
                # Word's own bullet: the Symbol/Wingdings glyph in that font
                glyph, rf = p.marker_raw
                mk.font = rf
                runs.append(self.run(mk, glyph, base_font, raw=True))
            else:
                if len(p.marker) == 1:
                    mk.font = None if (ms.font in ('Symbol', 'Wingdings') or ms.font is None) else ms.font
                runs.append(self.run(mk, p.marker, base_font))
            runs.append('<w:r><w:tab/></w:r>')
            # text after the marker
            tx = p.left + left
            first_line = p.lines[0]
            runs += self.line_runs(first_line, left, skip_marker_until=tx, base_font=base_font)
            rest = p.lines[1:]
        else:
            rest = p.lines
        for i, l in enumerate(rest):
            lr = self.line_runs(l, left, base_font=base_font, spaces=p.align in ('center', 'right'))
            if runs or (p.kind == 'list'):
                if runs:
                    prev_txt = (p.lines[0] if i == 0 and p.kind == 'list' else (rest[i - 1] if i > 0 else None))
                    pt = prev_txt.text.rstrip() if prev_txt is not None else ''
                    if not (pt.endswith('-') and len(pt) > 1 and pt[-2].isalpha()) and not pt.endswith('/'):
                        runs.append('<w:r><w:t xml:space="preserve"> </w:t></w:r>')
            runs += lr
        return f'<w:p><w:pPr>{"".join(ppr)}</w:pPr>{"".join(runs)}</w:p>'

    def table(self, t: Table, margin_left, base_font, page_break=False, before=0):
        grid = [t.cols[i + 1] - t.cols[i] for i in range(len(t.cols) - 1)]
        out = ['<w:tbl><w:tblPr>']
        out.append(f'<w:tblW w:w="{round(sum(grid) * TW)}" w:type="dxa"/>')
        ind = t.x0 - margin_left + (getattr(t, 'pad', 5.4) if getattr(self, 'compat', 15) <= 14 else 0)
        out.append(f'<w:tblInd w:w="{round(ind * TW)}" w:type="dxa"/>')
        out.append('<w:tblLayout w:type="fixed"/>')
        padt = round(getattr(t, 'pad', 5.4) * TW)
        out.append(f'<w:tblCellMar><w:left w:w="{padt}" w:type="dxa"/><w:right w:w="{padt}" w:type="dxa"/></w:tblCellMar>')
        out.append('<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/>')
        out.append('</w:tblPr><w:tblGrid>')
        out += [f'<w:gridCol w:w="{round(g * TW)}"/>' for g in grid]
        out.append('</w:tblGrid>')
        nrows = len(t.rows) - 1
        at = {(c['r'], c['c']): c for c in t.cells}
        covered = {}
        for c in t.cells:
            for rr in range(c['r'] + 1, c['r'] + c['rs']):
                covered[(rr, c['c'])] = c
        for r in range(nrows):
            h = t.rows[r + 1] - t.rows[r]
            # Word adds the border widths on top of the content: when every
            # cell's text fits the row as it was, pin the row height exactly
            fits = True
            for c in t.cells:
                if c['r'] == r and c['rs'] == 1 and c.get('paras'):
                    if _bottom_y(c['paras'][-1], base_font) > c['bbox'][3] + 0.5:
                        fits = False
                        break
            rule = 'exact' if fits else 'atLeast'
            out.append(f'<w:tr><w:trPr><w:trHeight w:val="{max(1, round(h * TW))}" w:hRule="{rule}"/><w:cantSplit/></w:trPr>')
            ci = 0
            ncols = len(grid)
            while ci < ncols:
                c = at.get((r, ci))
                cont = covered.get((r, ci))
                if c is None and cont is None:
                    out.append(f'<w:tc><w:tcPr><w:tcW w:w="{round(grid[ci] * TW)}" w:type="dxa"/></w:tcPr><w:p/></w:tc>')
                    ci += 1
                    continue
                src = c or cont
                cs = src['cs']
                w = sum(grid[ci:ci + cs])
                tcpr = [f'<w:tcW w:w="{round(w * TW)}" w:type="dxa"/>']
                if cs > 1:
                    tcpr.append(f'<w:gridSpan w:val="{cs}"/>')
                if src['rs'] > 1:
                    tcpr.append('<w:vMerge w:val="restart"/>' if c else '<w:vMerge/>')
                bd = src.get('borders') or {}
                bx = []
                for side in ('top', 'left', 'bottom', 'right'):
                    v = bd.get(side)
                    if v:
                        col, th = v
                        bx.append(f'<w:{side} w:val="single" w:sz="{max(2, min(48, round(th * 8)))}" w:space="0" w:color="{col}"/>')
                    else:
                        bx.append(f'<w:{side} w:val="nil"/>')
                tcpr.append('<w:tcBorders>' + ''.join(bx) + '</w:tcBorders>')
                if src.get('shade'):
                    tcpr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{src["shade"]}"/>')
                if src.get('valign') and src['valign'] != 'top':
                    tcpr.append(f'<w:vAlign w:val="{src["valign"]}"/>')
                body = ''
                if c is not None and c.get('paras'):
                    x0 = c['bbox'][0] + getattr(t, 'pad', 5.4)
                    ps = c['paras']
                    # vertical offset of the first paragraph inside the cell
                    pad_top = max(0, _top_y(ps[0], base_font) - c['bbox'][1] - 0.5) if src.get('valign', 'top') == 'top' else 0
                    prev = None
                    lf = None
                    for k, p in enumerate(ps):
                        bf = None
                        if k == 0:
                            bf = min(pad_top, 24)
                        elif prev is not None:
                            bf = _gap_before(prev, p, base_font)
                        body += self.para(p, x0, base_font, lf, before_pt=bf)
                        prev = p
                if not body:
                    body = '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>'
                out.append(f'<w:tc><w:tcPr>{"".join(tcpr)}</w:tcPr>{body}</w:tc>')
                ci += cs
            out.append('</w:tr>')
        out.append('</w:tbl>')
        return ''.join(out)

    def image(self, im: Image, left, page_break=False, before=0):
        self.n += 1
        name = f'image{self.n}.{"jpeg" if im.ext == "jpeg" else "png"}'
        self.media.append((name, im.data))
        rid = self.rid('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', f'media/{name}')
        cx = round((im.x1 - im.x0) * EMU)
        cy = round((im.y1 - im.y0) * EMU)
        pid = self.n
        ppr = '<w:pageBreakBefore/>' if page_break else ''
        ppr += f'<w:spacing w:before="{max(0, round(before * TW))}" w:after="0" w:line="240" w:lineRule="auto"/>'
        ppr += f'<w:ind w:left="{max(0, round(left * TW))}"/>'
        return (f'<w:p><w:pPr>{ppr}</w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
                f'<wp:extent cx="{cx}" cy="{cy}"/><wp:docPr id="{pid}" name="Picture {pid}"/>'
                '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
                '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
                f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="{pid}" name="{name}"/><pic:cNvPicPr/></pic:nvPicPr>'
                f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
                f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
                '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>')


def _top(b):
    if isinstance(b, Para):
        return b.rule_y - 0.5 if b.empty else b.lines[0].y0
    return b.y0


def _bottom(b):
    if isinstance(b, Para):
        return b.rule_y + 0.5 if b.empty else b.lines[-1].y1
    return b.y1


def _line_font(line: Line, base_font):
    big = max(line.spans, key=lambda s: (s.size, len(s.text)))
    return big.font or base_font, line.size


def line_model(p: Para, base_font='Calibri'):
    """How Word will place this paragraph's lines -> (rule, line value, first
    baseline below the paragraph top, last line's part below its baseline)."""
    fam1, size1 = _line_font(p.lines[0], base_font)
    famN, sizeN = _line_font(p.lines[-1], base_font)
    m1 = _metrics(fam1)
    mN = _metrics(famN)
    multi = bool(p.pitch) and len(p.lines) >= 2
    if m1 is None or mN is None:
        # a font Word may not have: pin the lines with exact spacing
        H = p.pitch if multi else size1 * 1.17
        return 'exact', H, 0.8 * H, 0.2 * H
    lh1, asc1 = m1[0] * size1, m1[1] * size1
    lhN, ascN = mN[0] * sizeN, mN[1] * sizeN
    if multi:
        if p.pitch < min(lh1, lhN) - 0.4:
            return 'exact', p.pitch, 0.8 * p.pitch, 0.2 * p.pitch
        H1 = max(p.pitch, lh1)
        return 'atLeast', p.pitch, H1 - (lh1 - asc1), lhN - ascN
    return 'auto', 240, asc1, lh1 - asc1


def _bottom_y(b, base_font):
    if isinstance(b, Para):
        if b.empty:
            return b.rule_y + (b.border[1] if b.border else 0.5)
        _, _, _, d = line_model(b, base_font)
        y = b.lines[-1].base + d
        if b.border:
            y += b.border[1] + b.border[2]
        return y
    return b.y1


def _top_y(b, base_font):
    """where this block's box must start (the paragraph top, not the glyphs)."""
    if isinstance(b, Para):
        if b.empty:
            return b.rule_y - 1.0
        _, _, o, _ = line_model(b, base_font)
        return b.lines[0].base - o
    return b.y0


def _gap_before(prev, cur, base_font='Calibri'):
    """space before `cur` so its first baseline lands where it was."""
    return max(0, _top_y(cur, base_font) - _bottom_y(prev, base_font))


def _sect_xml(w, h, m, cols=1, gap=36, widths=None, hdr_rid=None, ftr_rid=None, cont=False, hdr_dist=36, ftr_dist=36):
    x = ['<w:sectPr>']
    if hdr_rid:
        x.append(f'<w:headerReference w:type="default" r:id="{hdr_rid}"/>')
    if ftr_rid:
        x.append(f'<w:footerReference w:type="default" r:id="{ftr_rid}"/>')
    if cont:
        x.append('<w:type w:val="continuous"/>')
    orient = ' w:orient="landscape"' if w > h else ''
    x.append(f'<w:pgSz w:w="{round(w * TW)}" w:h="{round(h * TW)}"{orient}/>')
    x.append(f'<w:pgMar w:top="{round(m["top"] * TW)}" w:right="{round(m["mr"] * TW)}" w:bottom="{round(m["mb"] * TW)}" '
             f'w:left="{round(m["left"] * TW)}" w:header="{round(hdr_dist * TW)}" w:footer="{round(ftr_dist * TW)}" w:gutter="0"/>')
    if cols > 1:
        if widths:
            x.append(f'<w:cols w:num="{cols}" w:space="{round(gap * TW)}" w:equalWidth="0">' + ''.join(
                f'<w:col w:w="{round(cw * TW)}" w:space="{round(gap * TW)}"/>' for cw in widths) + '</w:cols>')
        else:
            x.append(f'<w:cols w:num="{cols}" w:space="{round(gap * TW)}"/>')
    else:
        x.append('<w:cols w:space="720"/>')
    x.append('<w:docGrid w:linePitch="360"/></w:sectPr>')
    return ''.join(x)


def hf_xml(writer: Writer, paras, left, base_font, kind):
    body = []
    prev = None
    for p in paras:
        # page numbers: a lone number (or "Page N" / "N of M") becomes a PAGE field
        xml = writer.para(p, left, base_font, None, before_pt=0 if prev is None else _gap_before(prev, p, base_font))
        xml = re.sub(r'(<w:t xml:space="preserve">)((?:Page\s+)?)(\d{1,4})((?:\s*(?:of|/)\s*\d{1,4})?\s*)(</w:t>)',
                     lambda m: (m.group(1) + m.group(2) + m.group(5) +
                                '</w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
                                '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>' + m.group(3) + '</w:t></w:r>'
                                '<w:r><w:fldChar w:fldCharType="end"/></w:r><w:r>' + m.group(1) + m.group(4) + m.group(5))
                     if re.fullmatch(r'\s*(Page\s+)?\d{1,4}(\s*(of|/)\s*\d{1,4})?\s*', ''.join(l.text for l in p.lines), re.I) else m.group(0),
                     xml, count=1)
        body.append(xml)
        prev = p
    tag = 'w:hdr' if kind == 'header' else 'w:ftr'
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><{tag} {NS}>' + ''.join(body or ['<w:p/>']) + f'</{tag}>')


NS = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
      'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"')


def styles_xml(font, size):
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<w:styles {NS}><w:docDefaults><w:rPrDefault><w:rPr>'
            f'<w:rFonts w:ascii="{escape(font)}" w:hAnsi="{escape(font)}" w:cs="{escape(font)}" w:eastAsia="{escape(font)}"/>'
            f'<w:sz w:val="{round(size * 2)}"/><w:szCs w:val="{round(size * 2)}"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault>'
            '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
            '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
            '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>'
            '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:semiHidden/>'
            '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>'
            '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
            '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>'
            '</w:styles>')


def settings_xml(mode, embed=False):
    emb = '<w:embedTrueTypeFonts/><w:saveSubsetFonts/>' if embed else ''
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<w:settings {NS}>{emb}<w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/>'
            f'<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="{mode}"/></w:compat>'
            '</w:settings>')


def squeezed_spaces(all_paras):
    """True when justified lines in the PDF have word gaps narrower than the
    font's own space — the PDF came from Word 2013+, which squeezes them."""
    # a ragged line never has gaps below the font's space, so look at every
    # line — several of them, so one noisy line (a scan) can't decide it
    hits = measured = 0
    for p in all_paras:
        if p.empty or not p.lines:
            continue
        for l in p.lines:
            r = space_ratios(l)
            if len(r) >= 4:
                measured += 1
                if statistics.median(r) < 0.93:
                    hits += 1
    return hits >= 3


def convert(pdf_path, docx_path, pages=None, ocr=None):
    """ocr: {page number: OCR spec} for scanned pages read in the browser
    (see fq_ocr) — those pages are rebuilt from the OCR text, not the picture."""
    doc = pymupdf.open(pdf_path)
    if doc.needs_pass:
        raise RuntimeError('This PDF is password-protected. Unlock it first.')
    idx = list(range(doc.page_count)) if not pages else [p for p in pages if 0 <= p < doc.page_count]
    if not idx:
        raise RuntimeError('No pages to convert.')

    pages_lines, widths, heights = [], [], []
    # scanned pages: one body font for the whole document, judged on all of them
    ocr_family = None
    if ocr and ocr_spans:
        try:
            from fq_ocr import pick_family
            ocr_family = pick_family([v for k, v in ocr.items() if k in idx])[0]
        except Exception:  # noqa: BLE001
            ocr_family = None
    try:
        fontbook = FontBook(doc, idx) if FontBook else None
    except Exception:  # noqa: BLE001
        fontbook = None
    _DOC_METRICS.set(fontbook.metrics() if fontbook else {})
    per_page = []
    for pi, pno in enumerate(idx):
        page = doc[pno]
        page.remove_rotation() if page.rotation else None
        spec = (ocr or {}).get(pno) if ocr_spans else None
        if spec:
            # a scan read by OCR: the words and table cells come from the browser
            spans = ocr_spans(spec, Span, ocr_family)
            tables, hrules, vrules = ocr_tables(spec, spans, Table)
            fills = []
            lines = group_lines(spans)
            mark_decorations(lines, hrules, fills, tables)
            pages_lines.append(lines)
            widths.append(page.rect.width)
            heights.append(page.rect.height)
            per_page.append((page, tables, [], hrules, fills, set(range(len(hrules)))))
            continue
        turn = _text_turn(page)
        if turn:
            page.set_rotation(turn)
            page.remove_rotation()
        spans = extract_spans(page, fontbook)
        spans += bullet_dots(page, spans)
        hrules, vrules, fills = collect_rects(page)
        tables = detect_tables(page, hrules, vrules, fills, spans)
        lines = group_lines(spans)
        # links
        try:
            for lk in page.get_links():
                if lk.get('uri'):
                    r = lk['from']
                    for l in lines:
                        for s in l.spans:
                            if s.x0 >= r.x0 - 1 and s.x1 <= r.x1 + 1 and s.y0 >= r.y0 - 2 and s.y1 <= r.y1 + 2:
                                s.link = lk['uri']
        except Exception:  # noqa: BLE001
            pass
        rule_used = mark_decorations(lines, hrules, fills, tables)
        images = extract_images(doc, page, lines)
        pages_lines.append(lines)
        widths.append(page.rect.width)
        heights.append(page.rect.height)
        per_page.append((page, tables, images, hrules, fills, rule_used))

    running = find_running(pages_lines, heights)
    margins = compute_margins(pages_lines, running, widths, heights)

    outs = []
    for pi, (page, tables, images, hrules, fills, rule_used) in enumerate(per_page):
        outs.append(layout_page(doc, page, pi, pages_lines[pi], running, margins, tables, images, hrules, fills, rule_used))

    # dominant body font
    fc = Counter()
    sc = Counter()
    for lines in pages_lines:
        for l in lines:
            for s in l.spans:
                if s.font:
                    fc[s.font] += len(s.text)
                sc[s.size] += len(s.text)
    base_font = fc.most_common(1)[0][0] if fc else 'Calibri'
    base_size = sc.most_common(1)[0][0] if sc else 11

    all_paras = []
    for o in outs:
        for sec in o.sections:
            all_paras += [b for b in sec.blocks if isinstance(b, Para)]
    compat = 15 if squeezed_spaces(all_paras) else 14

    w = Writer()
    w.compat = compat
    body = []
    W0, H0 = Counter((round(a, 1), round(b, 1)) for a, b in zip(widths, heights)).most_common(1)[0][0]
    m = dict(margins)
    m['mr'] = max(14, W0 - margins['right'])
    # bottom margin with slack: every page starts with its own page break anyway
    m['mb'] = max(14, margins.get('bottom_gap', H0 - margins['bottom']) * 0.6)

    # header / footer from the first page that has them
    hdr_rid = ftr_rid = None
    extra_parts = []
    hdr_dist = ftr_dist = 36
    for o in outs:
        if o.header and hdr_rid is None:
            hdr_dist = max(6, _top_y(o.header[0], base_font))
            xml = hf_xml(w, o.header, margins['left'], base_font, 'header')
            hdr_rid = w.rid('http://schemas.openxmlformats.org/officeDocument/2006/relationships/header', 'header1.xml')
            extra_parts.append(('word/header1.xml', xml, 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'))
        if o.footer and ftr_rid is None:
            ftr_dist = max(6, H0 - _bottom_y(o.footer[-1], base_font))
            xml = hf_xml(w, o.footer, margins['left'], base_font, 'footer')
            ftr_rid = w.rid('http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer', 'footer1.xml')
            extra_parts.append(('word/footer1.xml', xml, 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml'))
    # top margin = where the highest first block on any page starts (its line
    # box, not its glyphs), but never inside the header
    tops = []
    for o in outs:
        for sec in o.sections:
            first = next((b for b in sec.blocks if not isinstance(b, ColBreak)), None)
            if first is not None:
                tops.append(_top_y(first, base_font))
                break
    if tops:
        m['top'] = max(8, min(tops))
    if hdr_rid:
        hb = max(_bottom_y(o.header[-1], base_font) for o in outs if o.header)
        m['top'] = max(m['top'], hb + 1)

    THIN = '<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>'

    def emit_blocks(blocks, left, cursor, page_break_first):
        """Write blocks top to bottom. `cursor` is the y where the next block's
        box would start with no space before it; returns the y after the
        last block (the lower of the two columns for a column section)."""
        col_top = cursor
        lowest = cursor
        pending_pb = page_break_first
        for b in blocks:
            if isinstance(b, ColBreak):
                # the break ends column 1; its (1pt) paragraph mark opens column 2
                body.append(f'<w:p><w:pPr>{THIN}</w:pPr><w:r><w:br w:type="column"/></w:r></w:p>')
                lowest = max(lowest, cursor)
                cursor = col_top + 1
                continue
            before = max(0, _top_y(b, base_font) - cursor)
            if pending_pb and before > 0.5 and not isinstance(b, Table):
                # Word ignores space-before at the top of a new page; an exact-height
                # empty line keeps the page's first block where it was
                body.append(f'<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0" '
                            f'w:line="{max(20, round(before * TW))}" w:lineRule="exact"/></w:pPr></w:p>')
                pending_pb = False
                before = 0
            if isinstance(b, Para):
                body.append(w.para(b, left, base_font, None, page_break=pending_pb, before_pt=before))
            elif isinstance(b, Table):
                if pending_pb:
                    body.append(f'<w:p><w:pPr><w:pageBreakBefore/>{THIN}</w:pPr></w:p>')
                    before = max(0, before - 1)
                if before > 1:
                    body.append(f'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="{max(20, round(before * TW))}" w:lineRule="exact"/></w:pPr></w:p>')
                body.append(w.table(b, left, base_font))
            elif isinstance(b, Image):
                body.append(w.image(b, b.x0 - left, page_break=pending_pb, before=before))
            pending_pb = False
            cursor = _bottom_y(b, base_font)
        return max(lowest, cursor)

    cur = [outs[0].width, outs[0].height]   # page size of the section being written
    new_page_sect = [False]  # the next section must start on a new page (size change)

    def sect(cols=1, gap=36, widths=None, cont=True):
        c = cont and not new_page_sect[0]
        new_page_sect[0] = False
        return _sect_xml(cur[0], cur[1], m, cols, gap=gap, widths=widths, hdr_rid=hdr_rid, ftr_rid=ftr_rid,
                         cont=c, hdr_dist=hdr_dist, ftr_dist=ftr_dist)

    for pi, o in enumerate(outs):
        cursor = m['top']
        need_pb = pi > 0
        if pi > 0 and (abs(o.width - cur[0]) > 1 or abs(o.height - cur[1]) > 1):
            # a page of another size (e.g. one landscape page): close the section
            # for the old size; the new section starts the new page itself
            body.append(f'<w:p><w:pPr>{THIN}{sect()}</w:pPr></w:p>')
            cur[0], cur[1] = o.width, o.height
            new_page_sect[0] = True
            need_pb = False
        for si, sec in enumerate(o.sections):
            if sec.cols == 1:
                cursor = emit_blocks(sec.blocks, margins['left'], cursor, need_pb)
            else:
                # close the single-column part above with a continuous break
                if body:
                    body.append(f'<w:p><w:pPr>{THIN}{sect()}</w:pPr></w:p>')
                    if not need_pb:
                        cursor += 1
                cursor = emit_blocks(sec.blocks, margins['left'], cursor, need_pb)
                body.append(f'<w:p><w:pPr>{THIN}{sect(2, gap=sec.gap, widths=sec.widths)}</w:pPr></w:p>')
                cursor += 1
            if sec.blocks:
                need_pb = False
        if not any(sec.blocks for sec in o.sections):
            # blank page: keep it
            body.append('<w:p><w:pPr><w:pageBreakBefore/></w:pPr></w:p>' if need_pb else '<w:p/>')

    # continuous: after a two-column part the text carries on, on the same page
    body.append(sect())
    document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                f'<w:document {NS}><w:body>' + ''.join(body) + '</w:body></w:document>')

    rels = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>']
    for rid, typ, target, ext in w.rels:
        mode = ' TargetMode="External"' if ext else ''
        rels.append(f'<Relationship Id="{rid}" Type="{typ}" Target="{escape(target, {chr(34): "&quot;"})}"{mode}/>')
    # fonts the reader's PC may not have travel inside the document
    font_parts = []      # (part name, bytes)
    font_table = None
    try:
        embeds = fontbook.embeds(w.fonts.keys()) if fontbook else {}
    except Exception:  # noqa: BLE001
        embeds = {}
    if embeds:
        frels, fxml = [], []
        n = 0
        for fam, styles in embeds.items():
            tags = []
            for key, tag in (('Regular', 'embedRegular'), ('Bold', 'embedBold'), ('Italic', 'embedItalic'),
                             ('BoldItalic', 'embedBoldItalic')):
                if key not in styles:
                    continue
                n += 1
                data, fkey = obfuscate(styles[key])
                font_parts.append((f'word/fonts/font{n}.odttf', data))
                frels.append(f'<Relationship Id="rIdF{n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font{n}.odttf"/>')
                tags.append(f'<w:{tag} r:id="rIdF{n}" w:fontKey="{fkey}"/>')
            fxml.append(f'<w:font w:name="{escape(fam, {chr(34): "&quot;"})}"><w:charset w:val="00"/><w:family w:val="auto"/>'
                        f'<w:pitch w:val="variable"/>{"".join(tags)}</w:font>')
        font_table = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                      f'<w:fonts {NS}>' + ''.join(fxml) + '</w:fonts>',
                      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                      + ''.join(frels) + '</Relationships>')
        rels.append('<Relationship Id="rIdFontTable" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>')
    rels.append('</Relationships>')

    ct = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>'
          '<Default Extension="png" ContentType="image/png"/>'
          '<Default Extension="jpeg" ContentType="image/jpeg"/>'
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
          '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
          '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
          '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>']
    for part, _, typ in extra_parts:
        ct.append(f'<Override PartName="/{part}" ContentType="{typ}"/>')
    if font_table:
        ct.append(f'<Default Extension="odttf" ContentType="{OBFUSCATED}"/>')
        ct.append('<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>')
    ct.append('</Types>')

    root_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
                 '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
                 '</Relationships>')
    core = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>FileQuick</dc:creator></cp:coreProperties>')

    with zipfile.ZipFile(docx_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', ''.join(ct))
        z.writestr('_rels/.rels', root_rels)
        z.writestr('docProps/core.xml', core)
        z.writestr('word/document.xml', document)
        z.writestr('word/styles.xml', styles_xml(base_font, base_size))
        z.writestr('word/settings.xml', settings_xml(compat, embed=bool(font_table)))
        if font_table:
            z.writestr('word/fontTable.xml', font_table[0])
            z.writestr('word/_rels/fontTable.xml.rels', font_table[1])
            for part, data in font_parts:
                z.writestr(part, data)
        z.writestr('word/_rels/document.xml.rels', ''.join(rels))
        for part, xml, _ in extra_parts:
            z.writestr(part, xml)
        for name, data in w.media:
            z.writestr(f'word/media/{name}', data)
    doc.close()


if __name__ == '__main__':
    import sys
    convert(sys.argv[1], sys.argv[2])
