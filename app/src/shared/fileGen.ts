/* Demo attachment downloads: records store file NAMES only, so downloading
   generates a small valid file of the matching type on the fly — real PDF,
   DOCX and XLSX (stored-zip, local CRC32), canvas images, UTF-8 text — and
   triggers a sandbox-safe download (popup escape for hosted demos). */

function crc32(u8: Uint8Array): number {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0 ^ -1;
  for (let i = 0; i < u8.length; i++) crc = (crc >>> 8) ^ table[(crc ^ u8[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

export function storedZip(files: [string, string][], mime: string): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number) => new Uint8Array([v & 255, (v >> 8) & 255]);
  const u32 = (v: number) => new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255]);
  const cat = (...parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((a, b) => a + b.length, 0));
    let o = 0; parts.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  };
  for (const [name, content] of files) {
    const nameB = enc.encode(name);
    const dataB = enc.encode(content);
    const crc = crc32(dataB);
    const local = cat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(dataB.length), u32(dataB.length), u16(nameB.length), u16(0), nameB, dataB);
    chunks.push(local);
    central.push(cat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(dataB.length), u32(dataB.length), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameB));
    offset += local.length;
  }
  const centralAll = cat(...central);
  const eocd = cat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralAll.length), u32(offset), u16(0));
  return new Blob([cat(...chunks, centralAll, eocd)], { type: mime });
}

/** Minimal single-page PDF (latin text only — basic fonts can't shape Arabic). */
function pdfBlob(name: string): Blob {
  const safe = name.replace(/[^\x20-\x7e]/g, '_').replace(/[()\\]/g, '_');
  const stream = `BT /F1 14 Tf 60 780 Td (Demo attachment - Sector Head Follow-up Platform) Tj ET\nBT /F1 11 Tf 60 758 Td (File: ${safe}) Tj ET\nBT /F1 11 Tf 60 736 Td (Generated for demonstration purposes.) Tj ET`;
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${stream.length}>>stream\n${stream}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj${o}endobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  body += `trailer<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([body], { type: 'application/pdf' });
}

const X = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function docxBlob(name: string): Blob {
  const p = (t: string, b?: boolean) => `<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr>${b ? '<w:b/><w:sz w:val="30"/>' : ''}<w:rtl/></w:rPr><w:t xml:space="preserve">${X(t)}</w:t></w:r></w:p>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p('مرفق تجريبي — منصة متابعة رئيس القطاع', true)}${p('اسم الملف: ' + name)}${p('هذا الملف مولَّد لأغراض العرض التجريبي.')}<w:sectPr><w:bidi/></w:sectPr></w:body></w:document>`;
  return storedZip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', doc],
  ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

function xlsxBlob(name: string): Blob {
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>مرفق تجريبي — منصة متابعة رئيس القطاع</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>${X(name)}</t></is></c></row></sheetData></worksheet>`;
  return storedZip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Demo" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', sheet],
  ], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function imageBlob(name: string, jpeg: boolean): Promise<Blob> {
  return new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 360;
    const g = c.getContext('2d')!;
    g.fillStyle = '#eef3f0'; g.fillRect(0, 0, 640, 360);
    g.fillStyle = '#1e4634'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.direction = 'rtl';
    g.fillText('مرفق تجريبي — منصة متابعة رئيس القطاع', 320, 160);
    g.font = '15px sans-serif'; g.fillStyle = '#5b6b62';
    g.fillText(name, 320, 200);
    c.toBlob((b) => resolve(b || new Blob()), jpeg ? 'image/jpeg' : 'image/png', 0.9);
  });
}

/** Sandbox-safe download: hosted demos run in an iframe that blocks
 *  same-frame downloads, so fire it from an escaped popup when framed. */
export function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const click = (doc: Document) => {
    const a = doc.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    doc.body.appendChild(a); a.click(); a.remove();
  };
  const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();
  if (inFrame) {
    const w = window.open('', '_blank');
    if (w) {
      try {
        w.document.write('<meta charset="utf-8"><title>' + name.replace(/</g, '') + '</title><p style="font-family:sans-serif;direction:rtl;padding:24px">جارٍ تنزيل الملف… يمكن إغلاق هذا التبويب.</p>');
        click(w.document);
        setTimeout(() => { try { w.close(); } catch { /* noop */ } }, 2500);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
      } catch {
        try { w.location.href = url; return; } catch { /* fall through */ }
      }
    }
  }
  click(document);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Download a demo file matching the attachment's name/extension. */
export async function downloadNamedFile(name: string) {
  const clean = (name || 'مرفق.pdf').trim() || 'مرفق.pdf';
  const ext = (clean.split('.').pop() || '').toLowerCase();
  let blob: Blob;
  if (ext === 'pdf') blob = pdfBlob(clean);
  else if (ext === 'docx' || ext === 'doc') blob = docxBlob(clean);
  else if (ext === 'xlsx' || ext === 'xls') blob = xlsxBlob(clean);
  else if (ext === 'csv') blob = new Blob(['﻿مرفق تجريبي,منصة متابعة رئيس القطاع\nالملف,' + clean], { type: 'text/csv;charset=utf-8' });
  else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) blob = await imageBlob(clean, ext !== 'png');
  else blob = new Blob(['﻿مرفق تجريبي — منصة متابعة رئيس القطاع\nاسم الملف: ' + clean + '\nمولَّد لأغراض العرض التجريبي.'], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, /\.[A-Za-z0-9]+$/.test(clean) ? clean : clean + '.txt');
}
