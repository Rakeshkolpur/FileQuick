/**
 * Excel → PDF: make every sheet print one page wide (like Excel's "Fit All
 * Columns on One Page"), so wide sheets aren't cut into strips of columns.
 * Wide sheets (many columns) also switch to landscape. Sheets whose owner
 * already chose a fit-to-page setting are left alone.
 */
import JSZip from 'jszip';

const colNumber = (letters) => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);

// Elements that must come after <pageSetup> in a worksheet (schema order).
const AFTER_PAGE_SETUP = /<(headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/;

function fitSheet(xml) {
  if (/fitToPage="(1|true)"/.test(xml)) return xml; // the owner already set it
  const dim = xml.match(/<dimension ref="[A-Z]+\d+:([A-Z]+)\d+"/);
  const wide = dim ? colNumber(dim[1]) > 8 : false;

  // <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr> — sheetPr is the first child.
  let out = xml;
  if (/<pageSetUpPr\b/.test(out)) {
    out = out.replace(/<pageSetUpPr\b/, '<pageSetUpPr fitToPage="1"');
  } else if (/<sheetPr\b[^>]*\/>/.test(out)) {
    out = out.replace(/<sheetPr\b([^>]*)\/>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/></sheetPr>');
  } else if (/<sheetPr\b[^>]*>/.test(out)) {
    // pageSetUpPr goes after tabColor / outlinePr
    out = out.replace(/<\/sheetPr>/, '<pageSetUpPr fitToPage="1"/></sheetPr>');
  } else {
    out = out.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
  }

  // <pageSetup fitToWidth="1" fitToHeight="0" …/>
  if (/<pageSetup\b/.test(out)) {
    out = out.replace(/<pageSetup\b([^>]*?)(\/?)>/, (m, attrs, close) => {
      let a = attrs.replace(/\s(fitToWidth|fitToHeight)="[^"]*"/g, '');
      a += ' fitToWidth="1" fitToHeight="0"';
      if (wide && !/orientation=/.test(a)) a += ' orientation="landscape"';
      return `<pageSetup${a}${close}>`;
    });
  } else {
    // A new <pageSetup> without paperSize would mean US Letter — keep A4.
    const tag = `<pageSetup paperSize="9" fitToWidth="1" fitToHeight="0"${wide ? ' orientation="landscape"' : ''}/>`;
    const m = out.match(AFTER_PAGE_SETUP);
    out = m ? out.slice(0, m.index) + tag + out.slice(m.index) : out.replace('</worksheet>', `${tag}</worksheet>`);
  }
  return out;
}

export async function fitXlsxToWidth(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const sheets = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    if (!sheets.length) return file;
    for (const n of sheets) {
      // eslint-disable-next-line no-await-in-loop
      const xml = await zip.file(n).async('string');
      zip.file(n, fitSheet(xml));
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    return new File([blob], file.name, { type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } catch {
    return file; // leave the workbook as it was
  }
}
