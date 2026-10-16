"""Fonts for the PDF -> Word engine.

* The real font name: a PDF names fonts by their PostScript name
  ("FranklinGothic-Medium", "Trebuchet-BoldItalic"), which is not always what
  Word calls them. The font program embedded in the PDF still carries its
  own name table, and its family name (name ID 1) is exactly the name Word
  lists — so we read it from there.
* Embedding: a font that is not a standard Windows/Office font (a brand font,
  a Google font, an old Hindi font like Kruti Dev …) would be swapped for
  another one on a PC that lacks it. The PDF already holds the letters it
  used, so we hand them to Word as an embedded font: the document then looks
  the same everywhere. The font's own licence flags are respected — a font
  marked "no embedding" is never embedded.
"""
from __future__ import annotations

import io
import re
import uuid

try:
    from fontTools.ttLib import TTFont, newTable
    from fontTools.ttLib.tables._c_m_a_p import cmap_format_4, cmap_format_12

    HAS_FONTTOOLS = True
except Exception:  # noqa: BLE001
    HAS_FONTTOOLS = False

# Fonts every Windows PC with Office has: no need to embed these.
STANDARD = {s.lower() for s in (
    'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold', 'Arial Unicode MS', 'Aptos', 'Aptos Display',
    'Aptos Narrow', 'Bahnschrift', 'Book Antiqua', 'Bookman Old Style', 'Calibri', 'Calibri Light', 'Cambria',
    'Cambria Math', 'Candara', 'Candara Light', 'Century', 'Century Gothic', 'Comic Sans MS', 'Consolas',
    'Constantia', 'Corbel', 'Corbel Light', 'Courier New', 'Ebrima', 'Franklin Gothic Book',
    'Franklin Gothic Demi', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Garamond', 'Georgia',
    'Gill Sans MT', 'Impact', 'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Lucida Console', 'Lucida Sans',
    'Lucida Sans Unicode', 'Malgun Gothic', 'Marlett', 'Microsoft Himalaya', 'Microsoft JhengHei',
    'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif', 'Microsoft Tai Le',
    'Microsoft YaHei', 'Microsoft Yi Baiti', 'MingLiU-ExtB', 'Mongolian Baiti', 'MS Gothic', 'MS Mincho',
    'MS PGothic', 'MV Boli', 'Myanmar Text', 'Nirmala UI', 'Nirmala Text', 'Palatino Linotype', 'Segoe Print',
    'Segoe Script', 'Segoe UI', 'Segoe UI Black', 'Segoe UI Emoji', 'Segoe UI Historic', 'Segoe UI Light',
    'Segoe UI Semibold', 'Segoe UI Semilight', 'Segoe UI Symbol', 'SimSun', 'Sitka Text', 'Sitka Small',
    'Sitka Heading', 'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings',
    'Wingdings', 'Wingdings 2', 'Wingdings 3', 'Yu Gothic', 'Mangal', 'Kokila', 'Aparajita', 'Utsaah',
    'Tunga', 'Latha', 'Gautami', 'Kartika', 'Vrinda', 'Shruti', 'Raavi', 'Kalinga', 'Vijaya', 'Agency FB',
    'Algerian', 'Baskerville Old Face', 'Bell MT', 'Berlin Sans FB', 'Bodoni MT', 'Britannic Bold',
    'Brush Script MT', 'Californian FB', 'Calisto MT', 'Castellar', 'Centaur', 'Century Schoolbook',
    'Cooper Black', 'Copperplate Gothic Bold', 'Copperplate Gothic Light', 'Edwardian Script ITC', 'Elephant',
    'Felix Titling', 'Footlight MT Light', 'Forte', 'Gigi', 'Gill Sans MT Condensed', 'Goudy Old Style',
    'Haettenschweiler', 'Harrington', 'High Tower Text', 'Lucida Bright', 'Lucida Calligraphy',
    'Lucida Fax', 'Lucida Handwriting', 'Magneto', 'Maiandra GD', 'Monotype Corsiva', 'Old English Text MT',
    'Onyx', 'Perpetua', 'Rockwell', 'Script MT Bold', 'Showcard Gothic', 'Stencil', 'Tw Cen MT',
    'Wide Latin',
)}

OBFUSCATED = 'application/vnd.openxmlformats-officedocument.obfuscatedFont'


# Metric-compatible stand-ins (LibreOffice / Linux) -> the font they copy
CLONES = {'carlito': 'Calibri', 'caladea': 'Cambria', 'liberation serif': 'Times New Roman',
          'liberation sans': 'Arial', 'liberation sans narrow': 'Arial Narrow', 'liberation mono': 'Courier New',
          'tinos': 'Times New Roman', 'arimo': 'Arial', 'cousine': 'Courier New', 'gelasio': 'Georgia',
          'selawik': 'Segoe UI', 'nimbus roman': 'Times New Roman', 'nimbus sans': 'Arial',
          'nimbus mono ps': 'Courier New', 'times': 'Times New Roman', 'helvetica': 'Arial'}


def _clean(name):
    return re.sub(r'^[A-Z]{6}\+', '', name or '')


def _style_of(sub):
    s = (sub or '').lower()
    bold = 'bold' in s or 'black' in s or 'heavy' in s
    italic = 'italic' in s or 'oblique' in s
    return bold, italic


class FontBook:
    """Real family names (and embeddable programs) of the fonts in a PDF."""

    def __init__(self, doc, page_numbers):
        self.by_name = {}      # PDF font name (no subset tag) -> info dict
        self.glyphs = {}       # PDF font name -> {unicode: gid}
        self._adv = {}         # (font name, size) -> [measured advance, font advance in em]
        self._em = {}          # font name -> [sum of em advances, count]
        if not HAS_FONTTOOLS:
            return
        seen = set()
        for pno in page_numbers:
            page = doc[pno]
            try:
                fonts = page.get_fonts(full=True)
            except Exception:  # noqa: BLE001
                continue
            for f in fonts:
                xref, basefont = f[0], f[3]
                if xref in seen or not xref:
                    continue
                seen.add(xref)
                info = self._read(doc, xref)
                if info:
                    self.by_name.setdefault(_clean(basefont), info)
            # which glyph draws which character: needed to give an embedded
            # subset font a proper Unicode map
            try:
                for sp in page.get_texttrace():
                    name = _clean(sp.get('font', ''))
                    m = self.glyphs.setdefault(name, {})
                    chars = sp.get('chars', ())
                    for ch in chars:
                        u, g = ch[0], ch[1]
                        if u > 31 and g >= 0:
                            m.setdefault(u, g)
                    self._measure(name, sp.get('size', 0), chars)
            except Exception:  # noqa: BLE001
                pass

    @staticmethod
    def _read(doc, xref):
        try:
            _, ext, _, buf = doc.extract_font(xref)
        except Exception:  # noqa: BLE001
            return None
        if not buf or ext not in ('ttf', 'otf'):
            return None
        try:
            tt = TTFont(io.BytesIO(buf), lazy=True)
            fam = sub = None
            if 'name' in tt:
                nm = tt['name']
                fam = nm.getDebugName(1)
                sub = nm.getDebugName(2)
            fs = tt['OS/2'].fsType if 'OS/2' in tt else 0
            truetype = 'glyf' in tt
            metrics = word_metrics(tt)
            tt.close()
        except Exception:  # noqa: BLE001
            return None
        if not fam or not fam.strip() or fam.lower().startswith(('untitled', 'font')):
            return None
        fam = fam.strip()
        # some PDF makers put the style into the family name ("X Bold", "X Regular")
        m = re.match(r'^(.*?)[ -]+(Regular|Bold Italic|BoldItalic|Bold|Italic|Oblique)$', fam, re.I)
        if m and m.group(1).strip():
            fam = m.group(1).strip()
            if (sub or 'regular').lower() in ('regular', 'roman', 'normal', 'book'):
                sub = m.group(2)
        bold, italic = _style_of(sub)
        fam = CLONES.get(fam.lower(), fam)
        return {'family': fam, 'sub': sub or 'Regular', 'bold': bold, 'italic': italic,
                'fsType': fs, 'buf': buf, 'truetype': truetype, 'metrics': metrics}

    def _hm(self, name):
        info = self.by_name.get(name)
        if not info:
            return None
        if 'hm' not in info:
            try:
                tt = TTFont(io.BytesIO(info['buf']), lazy=True)
                info['hm'] = (tt['hmtx'].metrics, tt.getGlyphOrder(), tt['head'].unitsPerEm)
            except Exception:  # noqa: BLE001
                info['hm'] = None
        return info['hm']

    def _measure(self, name, size, chars):
        """How far each letter really moves the pen vs. the font's own width:
        a PDF printed at a scale (Print to PDF, 'fit to page') shows letters at
        a size Word cannot set exactly — this finds that true size."""
        hm = self._hm(name)
        if not hm or not size or len(chars) < 5:
            return
        metrics, order, upem = hm
        meas = nat = 0.0
        for k in range(len(chars) - 1):
            u, g = chars[k][0], chars[k][1]
            if u == 32 or chars[k + 1][0] == 32 or g < 0 or g >= len(order):
                continue
            adv = metrics.get(order[g], (0, 0))[0] / upem
            if adv <= 0:
                continue
            meas += chars[k + 1][2][0] - chars[k][2][0]
            nat += adv
        if nat > 0:
            a = self._adv.setdefault((name, round(size, 1)), [0.0, 0.0])
            a[0] += meas
            a[1] += nat
            e = self._em.setdefault(name, [0.0, 0])
            e[0] += nat
            e[1] += sum(1 for k in range(len(chars) - 1) if chars[k][0] != 32 and chars[k + 1][0] != 32)

    def avg_em(self, name):
        """Average letter width of this font in the document, in em (or None)."""
        e = self._em.get(_clean(name))
        return e[0] / e[1] if e and e[1] >= 10 else None

    def true_size(self, name, size):
        """(effective size, average em advance) or None."""
        name = _clean(name)
        a = self._adv.get((name, round(size, 1)))
        e = self._em.get(name)
        if not a or a[1] < 10 or not e or not e[1]:
            return None
        eff = a[0] / a[1]
        if abs(eff - size) > 0.08 * size:     # odd text (rotated, Tc tricks …): don't trust it
            return None
        return eff, e[0] / e[1]

    def metrics(self):
        """{family: (line height, baseline offset)} per em, as Word lays the font out."""
        out = {}
        for info in self.by_name.values():
            if info.get('metrics') and (info['family'] not in out or not (info['bold'] or info['italic'])):
                out[info['family']] = info['metrics']
        return out

    def lookup(self, pdf_font_name):
        """(family, bold, italic) from the embedded font, or None."""
        name = _clean(pdf_font_name)
        info = self.by_name.get(name)
        if not info and len(name) >= 12:
            # the text layer may carry a shortened name ("FranklinGothic-MediumIta")
            pre = sorted((k for k in self.by_name if k.startswith(name)), key=len)
            info = self.by_name[pre[0]] if pre else None
        if info:
            return info['family'], info['bold'], info['italic']
        # Word writes a faked bold/italic as "Font,Bold" / "Font,Italic"
        base, _, suffix = name.partition(',')
        info = self.by_name.get(base) if suffix else None
        if not info:
            return None
        sb, si = _style_of(suffix)
        return info['family'], info['bold'] or sb, info['italic'] or si

    # ------------------------------------------------------------------
    def embeds(self, used_families):
        """{family: {'Regular'|'Bold'|'Italic'|'BoldItalic': ttf bytes}} for the
        non-standard fonts actually used in the document."""
        out = {}
        if not HAS_FONTTOOLS:
            return out
        used = {f.lower() for f in used_families if f}
        for name, info in self.by_name.items():
            fam = info['family']
            if fam.lower() in STANDARD or fam.lower() not in used or not info['truetype']:
                continue
            fs = info['fsType'] or 0
            if fs & 0x0002 and not fs & 0x000C:   # "restricted licence": never embed
                continue
            key = ('Bold' if info['bold'] else '') + ('Italic' if info['italic'] else '') or 'Regular'
            if key in out.get(fam, {}):
                continue
            data = _embed_program(info['buf'], fam, key, self.glyphs.get(name, {}))
            if data:
                out.setdefault(fam, {})[key] = data
        return out


def word_metrics(tt):
    """Word's single line height and baseline offset (÷ em) for a TrueType
    font: winAscent + winDescent, plus the part of hhea's line gap that does
    not fit inside them (checked against Word for Calibri, Times, Arial …)."""
    try:
        upem = tt['head'].unitsPerEm
        os2, hh = tt['OS/2'], tt['hhea']
        wa, wd = os2.usWinAscent, os2.usWinDescent
        if not upem or wa + wd <= 0:
            return None
        ext = max(0, hh.lineGap - ((wa + wd) - (hh.ascent - hh.descent)))
        return ((wa + wd + ext) / upem, (wa + ext) / upem)
    except Exception:  # noqa: BLE001
        return None


def _embed_program(buf, family, style, umap):
    try:
        tt = TTFont(io.BytesIO(buf))
        if 'glyf' not in tt or 'OS/2' not in tt or 'head' not in tt:
            return None
        order = tt.getGlyphOrder()
        mapping = {}
        if 'cmap' in tt:
            best = tt['cmap'].getBestCmap()      # only real Unicode subtables
            if best:
                mapping.update(best)
        for u, g in umap.items():
            if 0 <= g < len(order):
                mapping[u] = order[g]
        if not mapping:
            return None
        # every font needs a plain space; a subset may only have the no-break one
        if 0x20 not in mapping:
            sp = mapping.get(0xA0) or next((g for g in ('space', 'uni0020', 'nbspace', 'uni00A0') if g in order), None)
            if sp:
                mapping[0x20] = sp
        if 0xA0 not in mapping and 0x20 in mapping:
            mapping[0xA0] = mapping[0x20]
        cm = newTable('cmap')
        cm.tableVersion = 0
        st = cmap_format_4(4)
        st.platformID, st.platEncID, st.language = 3, 1, 0
        st.cmap = {u: g for u, g in mapping.items() if u <= 0xFFFF}
        cm.tables = [st]
        if any(u > 0xFFFF for u in mapping):
            st12 = cmap_format_12(12)
            st12.platformID, st12.platEncID, st12.language = 3, 10, 0
            st12.cmap = dict(mapping)
            cm.tables.append(st12)
        tt['cmap'] = cm
        human = {'Regular': 'Regular', 'Bold': 'Bold', 'Italic': 'Italic', 'BoldItalic': 'Bold Italic'}[style]
        if 'name' not in tt:
            tt['name'] = newTable('name')
            tt['name'].names = []
        nm = tt['name']
        nm.names = [n for n in nm.names if n.nameID not in (1, 2, 4, 6, 16, 17)]
        ps = re.sub(r'[^A-Za-z0-9-]', '', family) + ('-' + style if style != 'Regular' else '')
        for nid, val in ((1, family), (2, human), (4, f'{family} {human}' if style != 'Regular' else family), (6, ps)):
            nm.setName(val, nid, 3, 1, 0x409)
        if 'post' not in tt:
            post = newTable('post')
            post.formatType = 3.0
            post.italicAngle = 0
            post.underlinePosition = -100
            post.underlineThickness = 50
            post.isFixedPitch = 0
            post.minMemType42 = post.maxMemType42 = post.minMemType1 = post.maxMemType1 = 0
            tt['post'] = post
        else:
            tt['post'].formatType = 3.0
        out = io.BytesIO()
        tt.save(out)
        return out.getvalue()
    except Exception:  # noqa: BLE001
        return None


def obfuscate(data):
    """Word's embedded-font obfuscation (ECMA-376 17.8.1): the first 32 bytes
    XOR the font key (the GUID's bytes in reverse). -> (bytes, '{GUID}')."""
    g = uuid.uuid4()
    key = bytes.fromhex(g.hex)[::-1]
    head = bytes(b ^ key[i % 16] for i, b in enumerate(data[:32]))
    return head + data[32:], '{' + str(g).upper() + '}'
