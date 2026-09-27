/**
 * Make a Word document carry its own fonts before it's converted.
 *
 * The conversion server (LibreOffice on Linux) doesn't have Microsoft's fonts
 * — Bookman Old Style, Times New Roman, Tahoma … — so it swaps in a
 * different font and the PDF looks wrong. Word files can embed their fonts
 * (Word's own "Embed fonts in the file" option, ECMA-376 §17.8.1), and
 * LibreOffice uses embedded fonts when it opens the file. So: find the fonts
 * the document uses, read them from the user's own computer (Local Font
 * Access — the browser asks once), and embed them the way Word does. The file
 * is only converted for the user; nothing is kept.
 */
import JSZip from 'jszip';
import { requestLocalFonts, localFontBytes, localFontsSupported } from './localFonts';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL_FONT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
const REL_FONT_TABLE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable';

const MAX_EMBED_BYTES = 24 * 1024 * 1024; // keep uploads reasonable

export const canEmbedFonts = () => localFontsSupported();

const TEXT_PARTS = /^word\/(document|styles|numbering|footnotes|endnotes|comments|header\d*|footer\d*)\.xml$/;

/** Families (and whether bold / italic appear) used by a .docx. */
export async function docxFontsUsed(zip) {
  const theme = {};
  const themeFile = zip.file(/^word\/theme\/theme\d*\.xml$/)[0];
  if (themeFile) {
    const t = await themeFile.async('string');
    const major = t.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]*)"/);
    const minor = t.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]*)"/);
    if (major) theme.major = major[1];
    if (minor) theme.minor = minor[1];
  }
  const names = new Set();
  let bold = false;
  let italic = false;
  const parts = Object.keys(zip.files).filter((n) => TEXT_PARTS.test(n));
  for (const p of parts) {
    // eslint-disable-next-line no-await-in-loop
    const xml = await zip.file(p).async('string');
    (xml.match(/<w:rFonts\b[^>]*>/g) || []).forEach((tag) => {
      ['ascii', 'hAnsi', 'cs', 'eastAsia'].forEach((a) => {
        const m = tag.match(new RegExp(`w:${a}="([^"]+)"`));
        if (m) names.add(m[1]);
      });
      ['asciiTheme', 'hAnsiTheme'].forEach((a) => {
        const m = tag.match(new RegExp(`w:${a}="(major|minor)`));
        if (m && theme[m[1]]) names.add(theme[m[1]]);
      });
    });
    if (/<w:b(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(xml)) bold = true;
    if (/<w:i(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(xml)) italic = true;
    if (p === 'word/styles.xml' && /w:styleId="Heading/.test(xml)) bold = true; // headings are bold by default
  }
  // No explicit fonts anywhere: Word's default body font is the theme's minor font.
  if (!names.size && theme.minor) names.add(theme.minor);
  if (theme.minor) names.add(theme.minor);
  return { families: [...names].filter((n) => n && !/^\+/.test(n)), bold, italic };
}

/** ECMA-376 font obfuscation: XOR the first 32 bytes with the GUID key, read backwards. */
const KEY_POS = [35, 33, 31, 29, 27, 25, 22, 20, 17, 15, 12, 10, 7, 5, 3, 1];
function obfuscate(bytes, fontKey) {
  const key = KEY_POS.map((p) => parseInt(fontKey.substr(p, 2), 16));
  const out = new Uint8Array(bytes);
  for (let i = 0; i < 16; i += 1) {
    out[i] ^= key[i];
    out[i + 16] ^= key[i];
  }
  return out;
}

const newKey = () => {
  const u = (crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-000000000000'.replace(/0/g, () => Math.floor(Math.random() * 16).toString(16))).toUpperCase();
  return `{${u}}`;
};

const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
const serialize = (doc) => new XMLSerializer().serializeToString(doc);

/**
 * Embed the user's installed copies of the document's fonts into the .docx.
 * Call requestLocalFonts() from the click first (it needs a user gesture).
 * Resolves { blob, embedded: [family], missing: [family] }; if anything goes
 * wrong the original file is returned untouched.
 */
export async function embedLocalFonts(file, { onStatus } = {}) {
  const result = { blob: file, embedded: [], missing: [] };
  if (!localFontsSupported() || !/\.docx$/i.test(file.name || '')) return result;
  try {
    const zip = await JSZip.loadAsync(file);
    if (!zip.file('word/document.xml')) return result;
    const { families, bold, italic } = await docxFontsUsed(zip);
    if (!families.length) return result;

    const list = await requestLocalFonts();
    if (!list.length) { result.missing = families; return result; }
    onStatus?.('Packing your fonts…');

    // font table (create it if the document has none)
    const ftPath = 'word/fontTable.xml';
    const ftDoc = zip.file(ftPath)
      ? parse(await zip.file(ftPath).async('string'))
      : parse(`<w:fonts xmlns:w="${W}" xmlns:r="${R}"/>`);
    const root = ftDoc.documentElement;
    if (!root.getAttribute('xmlns:r')) root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:r', R);
    const fontEls = [...root.getElementsByTagNameNS(W, 'font')];
    const alreadyEmbedded = new Set(fontEls
      .filter((el) => [...el.childNodes].some((c) => /^embed/.test(c.localName || '')))
      .map((el) => el.getAttributeNS(W, 'name')));

    const relsPath = 'word/_rels/fontTable.xml.rels';
    const relsDoc = zip.file(relsPath)
      ? parse(await zip.file(relsPath).async('string'))
      : parse(`<Relationships xmlns="${PKG_REL}"/>`);
    const relsRoot = relsDoc.documentElement;

    const styles = [['Regular', false, false]];
    if (bold) styles.push(['Bold', true, false]);
    if (italic) styles.push(['Italic', false, true]);
    if (bold && italic) styles.push(['BoldItalic', true, true]);

    let total = 0;
    let n = 0;
    for (const family of families) {
      if (alreadyEmbedded.has(family)) continue;
      let got = 0;
      const seen = new Set();
      for (const [kind, b, i] of styles) {
        // eslint-disable-next-line no-await-in-loop
        const f = await localFontBytes(family, b, i);
        if (!f || (!f.exact && kind !== 'Regular') || seen.has(f.name)) continue;
        if (total + f.bytes.length > MAX_EMBED_BYTES) continue;
        seen.add(f.name);
        n += 1;
        total += f.bytes.length;
        const key = newKey();
        const rid = `rIdFq${n}`;
        const target = `fonts/fq-font${n}.odttf`;
        zip.file(`word/${target}`, obfuscate(f.bytes, key));
        const rel = relsDoc.createElementNS(PKG_REL, 'Relationship');
        rel.setAttribute('Id', rid);
        rel.setAttribute('Type', REL_FONT);
        rel.setAttribute('Target', target);
        relsRoot.appendChild(rel);
        let el = fontEls.find((x) => x.getAttributeNS(W, 'name') === family);
        if (!el) {
          el = ftDoc.createElementNS(W, 'w:font');
          el.setAttributeNS(W, 'w:name', family);
          root.appendChild(el);
          fontEls.push(el);
        }
        const emb = ftDoc.createElementNS(W, `w:embed${kind}`);
        emb.setAttributeNS(R, 'r:id', rid);
        emb.setAttributeNS(W, 'w:fontKey', key);
        el.appendChild(emb);
        got += 1;
      }
      if (got) result.embedded.push(family); else result.missing.push(family);
    }
    if (!n) return result;

    zip.file(ftPath, serialize(ftDoc));
    zip.file(relsPath, serialize(relsDoc));

    // document.xml.rels must point at the font table
    const drPath = 'word/_rels/document.xml.rels';
    const drDoc = parse(await zip.file(drPath).async('string'));
    const drRoot = drDoc.documentElement;
    if (![...drRoot.getElementsByTagName('Relationship')].some((r) => r.getAttribute('Type') === REL_FONT_TABLE)) {
      const rel = drDoc.createElementNS(PKG_REL, 'Relationship');
      rel.setAttribute('Id', 'rIdFqFontTable');
      rel.setAttribute('Type', REL_FONT_TABLE);
      rel.setAttribute('Target', 'fontTable.xml');
      drRoot.appendChild(rel);
      zip.file(drPath, serialize(drDoc));
    }

    // content types: .odttf + the font table part
    const ctDoc = parse(await zip.file('[Content_Types].xml').async('string'));
    const ctRoot = ctDoc.documentElement;
    if (![...ctRoot.getElementsByTagName('Default')].some((d) => (d.getAttribute('Extension') || '').toLowerCase() === 'odttf')) {
      const d = ctDoc.createElementNS(CT, 'Default');
      d.setAttribute('Extension', 'odttf');
      d.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.obfuscatedFont');
      ctRoot.insertBefore(d, ctRoot.firstChild);
    }
    if (![...ctRoot.getElementsByTagName('Override')].some((o) => o.getAttribute('PartName') === '/word/fontTable.xml')) {
      const o = ctDoc.createElementNS(CT, 'Override');
      o.setAttribute('PartName', '/word/fontTable.xml');
      o.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml');
      ctRoot.appendChild(o);
    }
    zip.file('[Content_Types].xml', serialize(ctDoc));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    result.blob = new File([blob], file.name, { type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return result;
  } catch (e) {
    console.warn('Font embedding skipped:', e);
    return { blob: file, embedded: [], missing: [] };
  }
}
