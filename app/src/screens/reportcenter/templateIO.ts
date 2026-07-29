/* Shared template I/O for report workspaces: in-browser generation of real
   Word/Excel files and reading them back (zip + deflate-raw, no libraries). */
import { storedZip } from '../../shared/fileGen';

export const PLACEHOLDER = /^(اكتب هنا|-+)$/;

/* ---------------- Word (docx) generation ---------------- */
export const X = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const wP = (t: string, opts?: { bold?: boolean; size?: number }) => {
  const rpr = `<w:rPr>${opts?.bold ? '<w:b/>' : ''}${opts?.size ? `<w:sz w:val="${opts.size}"/>` : ''}<w:rtl/></w:rPr>`;
  return `<w:p><w:pPr><w:bidi/>${opts?.bold || opts?.size ? rpr : ''}</w:pPr><w:r>${rpr}<w:t xml:space="preserve">${X(t)}</w:t></w:r></w:p>`;
};
export const wTbl = (head: string[], rows: string[][]) => {
  const tc = (t: string, hdr: boolean) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${hdr ? '<w:shd w:val="clear" w:fill="EEF3F0"/>' : ''}</w:tcPr>${wP(t, hdr ? { bold: true } : undefined)}</w:tc>`;
  const tr = (cells: string[], hdr: boolean) => `<w:tr>${cells.map((c) => tc(c, hdr)).join('')}</w:tr>`;
  const borders = '<w:tblBorders><w:top w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:start w:val="single" w:sz="4"/><w:end w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders>';
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="5000" w:type="pct"/>${borders}</w:tblPr>${tr(head, true)}${rows.map((r) => tr(r, false)).join('')}</w:tbl>${wP('')}`;
};

/** Wrap a document body (built with wP/wTbl) into a complete .docx blob. */
export function makeDocx(body: string): Blob {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:bidi/></w:sectPr></w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  return storedZip([
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rels],
    ['word/document.xml', documentXml],
  ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

/* ---------------- Excel (xlsx) generation ---------------- */
/**
 * Build a one-sheet .xlsx that's tidy and easy to fill: RTL sheet, a styled
 * (green, bold, white) frozen header row, thin borders, and auto-sized columns.
 * The first row is treated as the header. Reads back losslessly (inline strings).
 */
export function makeXlsx(rows: string[][], sheetName = 'قالب'): Blob {
  const colRef = (j: number) => { let n = j + 1, s = ''; while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); } return s; };
  // s="1" header style, s="2" bordered body cell.
  const cell = (ref: string, v: string, header: boolean) => {
    const s = header ? ' s="1"' : (v ? ' s="2"' : '');
    return v ? `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${X(v)}</t></is></c>` : (header ? `<c r="${ref}"${s}/>` : '');
  };
  const nCols = rows.reduce((m, r) => Math.max(m, r.length), 1);
  // column width = longest cell in the column, clamped.
  const widthOf = (j: number) => {
    let w = 10;
    for (const r of rows) { const len = (r[j] || '').length; if (len + 3 > w) w = len + 3; }
    return Math.min(46, Math.max(12, w));
  };
  const cols = `<cols>${Array.from({ length: nCols }, (_, j) => `<col min="${j + 1}" max="${j + 1}" width="${widthOf(j)}" customWidth="1"/>`).join('')}</cols>`;
  const sheetView = `<sheetViews><sheetView rightToLeft="1" tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>`;
  const body = rows.map((r, i) => {
    const cells = Array.from({ length: nCols }, (_, j) => cell(colRef(j) + (i + 1), r[j] || '', i === 0)).join('');
    return `<row r="${i + 1}"${i === 0 ? ' ht="26" customHeight="1"' : ''}>${cells}</row>`;
  }).join('');
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetView}${cols}<sheetData>${body}</sheetData></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E4634"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD6CC"/></left><right style="thin"><color rgb="FFCBD6CC"/></right><top style="thin"><color rgb="FFCBD6CC"/></top><bottom style="thin"><color rgb="FFCBD6CC"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${X(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  return storedZip([
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rels],
    ['xl/workbook.xml', workbook],
    ['xl/_rels/workbook.xml.rels', wbRels],
    ['xl/styles.xml', styles],
    ['xl/worksheets/sheet1.xml', sheetXml],
  ], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/* ---------------- reading uploads back ---------------- */
export async function zipEntryText(buf: ArrayBuffer, name: string): Promise<string | null> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  for (let i = 0; i < u8.length - 4; i++) {
    if (dv.getUint32(i, true) !== 0x04034b50) continue;
    const method = dv.getUint16(i + 8, true);
    const compSize = dv.getUint32(i + 18, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const fname = new TextDecoder().decode(u8.slice(i + 30, i + 30 + nameLen));
    if (fname !== name) { i += 29; continue; }
    const start = i + 30 + nameLen + extraLen;
    const comp = u8.slice(start, start + compSize);
    if (method === 0) return new TextDecoder('utf-8').decode(comp);
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([comp]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  }
  return null;
}
export const docxText = (buf: ArrayBuffer) => zipEntryText(buf, 'word/document.xml');

/** Read a .pptx into ordered lines + tables (rows of cells), scanning every
 *  slide. DrawingML tables use <a:tbl>/<a:tr>/<a:tc>; text lives in <a:t>. */
export async function pptxBlocks(buf: ArrayBuffer): Promise<{ lines: string[]; tables: string[][][] } | null> {
  const lines: string[] = [];
  const tables: string[][][] = [];
  let found = false;
  for (let n = 1; n <= 100; n++) {
    const xml = await zipEntryText(buf, `ppt/slides/slide${n}.xml`);
    if (!xml) { if (n === 1) return null; break; }
    found = true;
    // tables
    for (const tbl of xml.match(/<a:tbl>[\s\S]*?<\/a:tbl>/g) || []) {
      const rows: string[][] = [];
      for (const tr of tbl.match(/<a:tr[ >][\s\S]*?<\/a:tr>/g) || []) {
        const cells = (tr.match(/<a:tc[ >][\s\S]*?<\/a:tc>/g) || []).map((tc) =>
          (tc.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('').trim());
        rows.push(cells);
      }
      if (rows.length) { tables.push(rows); lines.push(' TABLE' + (tables.length - 1)); }
    }
    // free paragraphs (for key/value fallback)
    for (const para of xml.match(/<a:p>[\s\S]*?<\/a:p>/g) || []) {
      const t = (para.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map((x) => x.replace(/<[^>]+>/g, '')).join('').trim();
      if (t) lines.push(t);
    }
  }
  return found ? { lines, tables } : null;
}

/** Read the first worksheet of an .xlsx into rows of cell strings
 *  (supports shared strings AND inline strings — Excel saves use shared). */
export async function xlsxRows(buf: ArrayBuffer): Promise<string[][] | null> {
  const sheet = await zipEntryText(buf, 'xl/worksheets/sheet1.xml');
  if (!sheet) return null;
  const sharedXml = await zipEntryText(buf, 'xl/sharedStrings.xml');
  const shared: string[] = [];
  if (sharedXml) {
    for (const si of sharedXml.match(/<si>[\s\S]*?<\/si>/g) || []) {
      shared.push((si.match(/<t[^>]*>([^<]*)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));
    }
  }
  const colIdx = (ref: string) => {
    const m = ref.match(/^[A-Z]+/); if (!m) return 0;
    let n = 0; for (const ch of m[0]) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  const rows: string[][] = [];
  for (const rowXml of sheet.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []) {
    const cells: string[] = [];
    // NB: match self-closing cells (`<c r="J2"/>`) BEFORE open/close ones — a
    // greedy `[^>]*` would swallow the `/` of `/>` and merge an empty cell with
    // the next one, shifting every following column left by one.
    for (const cXml of rowXml.match(/<c\b[^>]*?\/>|<c\b[^>]*?>[\s\S]*?<\/c>/g) || []) {
      const ref = (cXml.match(/r="([^"]+)"/) || [])[1] || '';
      const type = (cXml.match(/t="([^"]+)"/) || [])[1] || '';
      let val = '';
      if (type === 'inlineStr') {
        val = (cXml.match(/<t[^>]*>([^<]*)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('');
      } else {
        const v = (cXml.match(/<v[^>]*>([^<]*)<\/v>/) || [])[1] || '';
        val = type === 's' ? (shared[parseInt(v, 10)] ?? '') : v;
      }
      cells[colIdx(ref)] = val.trim();
    }
    rows.push(Array.from(cells, (c) => c || ''));
  }
  return rows.length ? rows : null;
}

/** Turn document XML/HTML into ordered lines + tables (rows of cells). */
export function toBlocks(src: string, isXml: boolean): { lines: string[]; tables: string[][][] } {
  const lines: string[] = [];
  const tables: string[][][] = [];
  if (isXml) {
    const re = /<w:p[ >][\s\S]*?<\/w:p>|<w:tbl>[\s\S]*?<\/w:tbl>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const seg = m[0];
      if (seg.startsWith('<w:tbl>')) {
        const rows: string[][] = [];
        for (const rm of seg.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []) {
          const cells = (rm.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || []).map((cm) => ((cm.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(' ')).trim());
          rows.push(cells);
        }
        tables.push(rows);
        lines.push(' TABLE' + (tables.length - 1));
      } else {
        const t = (seg.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((x) => x.replace(/<[^>]+>/g, '')).join('').trim();
        if (t) lines.push(t);
      }
    }
  } else {
    const doc = new DOMParser().parseFromString(src, 'text/html');
    const walk = (el: Element) => {
      for (const ch of Array.from(el.children)) {
        const tag = ch.tagName.toLowerCase();
        if (tag === 'table') {
          const rows = Array.from(ch.querySelectorAll('tr')).map((tr2) => Array.from(tr2.querySelectorAll('td,th')).map((c) => (c.textContent || '').trim()));
          tables.push(rows);
          lines.push(' TABLE' + (tables.length - 1));
        } else if (/^(h\d|p|li)$/.test(tag)) {
          const t = (ch.textContent || '').trim();
          if (t) lines.push(t);
          if (tag !== 'li') walk(ch);
        } else walk(ch);
      }
    };
    walk(doc.body);
  }
  return { lines, tables };
}

/** Read ANY supported upload (docx / xlsx / pptx / csv / html / txt) into blocks. */
export async function fileToBlocks(file: File): Promise<{ lines: string[]; tables: string[][][] } | null> {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 2));
  let blocks: { lines: string[]; tables: string[][][] } | null = null;
  if (head[0] === 0x50 && head[1] === 0x4b) {
    // Office Open XML (zip): Word → Excel → PowerPoint, whichever it is.
    const xml = await docxText(buf);
    if (xml) blocks = toBlocks(xml, true);
    else {
      const rows = await xlsxRows(buf);
      if (rows) blocks = { lines: [], tables: [rows] };
      else blocks = await pptxBlocks(buf);
    }
  } else if (/\.csv$/i.test(file.name)) {
    const text = new TextDecoder('utf-8').decode(buf);
    const sep = text.includes('\t') ? '\t' : (text.split(';').length > text.split(',').length ? ';' : ',');
    const rows = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(sep).map((c) => c.trim()));
    blocks = { lines: [], tables: [rows] };
  } else {
    const text = new TextDecoder('utf-8').decode(buf);
    blocks = toBlocks(text, false);
    if (!blocks.lines.length) blocks = { lines: text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), tables: [] };
  }
  if (!blocks || (!blocks.lines.length && !blocks.tables.length)) return null;
  return blocks;
}

/* ---------------- generic multi-row (bulk) parsing ---------------- */
export interface BulkCol { field: string; match: (h: string) => boolean; norm?: (v: string) => string }

/** A header-cell matcher: true if the cell contains any of the given labels. */
export const alias = (...labels: string[]) => (h: string) => labels.some((l) => h.includes(l));

/** A normalizer that snaps a free value to the closest allowed option
 *  (exact match first, then the LONGEST option contained in the value — so
 *  "كل أسبوعين" isn't mistaken for the shorter "أسبوعي"). */
export const pick = (options: string[], fallback = '') => (v: string) =>
  options.find((o) => o === v)
  || [...options].sort((a, b) => b.length - a.length).find((o) => v.includes(o))
  || fallback;

/**
 * Parse a multi-row sheet (header row + one record per row) into records.
 * Picks the largest table, locates the header by column-label hits, then maps
 * each subsequent non-empty row to a { field: value } object. Rows failing the
 * `required` predicate are skipped.
 */
export function parseBulk(
  tables: string[][][],
  cols: BulkCol[],
  required: (r: Record<string, string>) => boolean,
): Record<string, string>[] {
  const table = tables.slice().sort((a, b) => b.length - a.length)[0] || [];
  if (table.length < 2) return [];
  const need = Math.min(3, cols.length);
  let hi = table.findIndex((r) => cols.filter((c) => r.some((cell) => c.match((cell || '').trim()))).length >= need);
  if (hi < 0) hi = 0;
  const header = table[hi].map((c) => (c || '').trim());
  const map = cols.map((c) => ({ c, ci: header.findIndex((h) => c.match(h)) }));
  const out: Record<string, string>[] = [];
  for (let i = hi + 1; i < table.length; i++) {
    const row = table[i];
    if (!row.some((x) => (x || '').trim())) continue;
    const rec: Record<string, string> = {};
    map.forEach(({ c, ci }) => { if (ci >= 0) { const v = (row[ci] || '').trim(); if (v) rec[c.field] = c.norm ? c.norm(v) : v; } });
    if (required(rec)) out.push(rec);
  }
  return out;
}

/** Look up the value of a label→value row across all parsed tables. */
export function kvLookup(tables: string[][][], label: RegExp): string | undefined {
  for (const t of tables) for (const r of t) {
    if (label.test((r[0] || '').trim())) {
      const v = (r[1] || '').trim();
      if (v && !PLACEHOLDER.test(v)) return v;
    }
  }
  return undefined;
}

/** Excel stores typed dates as serial numbers — convert plausible ones to an Arabic date. */
const AR_MONS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export function excelSerialToDate(v: string): string {
  if (!/^\d{4,6}(\.\d+)?$/.test(v)) return v;
  const n = parseFloat(v);
  if (!isFinite(n) || n < 20000 || n > 80000) return v;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return d.getUTCDate() + ' ' + AR_MONS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}
