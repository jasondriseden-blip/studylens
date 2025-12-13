/* ===========================================================================================
   BLOCK X: Server-side PDF export endpoint (/api/pdf) — BASELINE (NO DEPENDENCIES) (START)
   Goal:
   - Prove your /api/pdf route works everywhere (mobile + desktop) with a real PDF response
   - No puppeteer, no chromium, no libraries
   - Accepts JSON: { title, text } (html is ignored for now)
=========================================================================================== */

function safeFilename(name) {
  const base = String(name || "export")
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return (base || "export") + ".pdf";
}

function makeMinimalPdfBuffer(text) {
  const chunks = [];
  let length = 0;
  const offsets = [0]; // obj offsets, index 0 unused

  const push = (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "latin1");
    chunks.push(buf);
    length += buf.length;
  };

  const obj = (n, body) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    push(body);
    if (!Buffer.isBuffer(body)) {
      if (!String(body).endsWith("\n")) push("\n");
    } else {
      if (!body.slice(-1).equals(Buffer.from("\n"))) push("\n");
    }
    push("endobj\n");
  };

  const esc = String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  // One line of text near top-left
  const content = `BT\n/F1 12 Tf\n72 720 Td\n(${esc}) Tj\nET\n`;
  const contentBytes = Buffer.from(content, "latin1");

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // 5 objects: Content, Font, Page, Pages, Catalog
  obj(5, Buffer.concat([Buffer.from(`<< /Length ${contentBytes.length} >>\nstream\n`, "latin1"), contentBytes, Buffer.from("endstream\n", "latin1")]));
  obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n");
  obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\n");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>\n");

  const xrefStart = length;
  push("xref\n");
  push(`0 6\n`);
  push("0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    const off = offsets[i] || 0;
    push(`${String(off).padStart(10, "0")} 0
