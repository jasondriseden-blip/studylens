/* ===========================================================================================
   BLOCK X: Server-side PDF Export (Vercel API)
   Goal:
   - Works on mobile + iMac + Windows (server generates the PDF)
   - Keeps formatting/highlights as best as possible (printBackground: true)
   - Removes the tool-output border/background in the PDF
   - Filename uses the provided "title" (subject)
   How it works:
   - Frontend POSTs { html, title, baseHref }
   - Server renders HTML in headless Chromium and returns a PDF download
=========================================================================================== */

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

function safeFilename(name) {
  const s = String(name || "Export").trim() || "Export";
  // keep it simple: letters/numbers/space/dash/underscore
  const cleaned = s.replace(/[^a-z0-9 _-]+/gi, "").trim();
  return (cleaned || "Export").slice(0, 80);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Use POST" }));
      return;
    }

    // Vercel usually parses JSON body automatically, but we handle both cases safely.
    const body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");

    const html = String(body.html || "");
    const title = safeFilename(body.title || "Export");
    const baseHref = String(body.baseHref || "");

    if (!html.trim()) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing html" }));
      return;
    }

    // ✅ Print CSS: remove the box/border/background; keep highlights if possible
    const printCss = `
      @page { margin: 14mm; }
      body { margin: 0; padding: 0; }
      .tool-output {
        border: none !important;
        background: transparent !important;
        padding: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
      }
      .tool-output-header { display: none !important; } /* no Copy button in PDF */
      .tool-output-body { white-space: pre-wrap; }
    `;

    // Wrap into a complete document so Chromium prints reliably
    const fullHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  ${baseHref ? `<base href="${baseHref.replace(/"/g, "&quot;")}">` : ""}
  <title>${title.replace(/</g, "&lt;")}</title>
  <style>${printCss}</style>
</head>
<body>
${html}
</body>
</html>`;

    const executablePath = await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setContent(fullHtml, { waitUntil: ["load", "networkidle0"] });

    const pdfBuffer = await page.pdf({
      format: "letter",          // change to "a4" if you want
      printBackground: true,     // ✅ keeps highlight/background colors where supported
      preferCSSPageSize: true,
      margin: { top: "14mm", right: "14mm", bottom: "14mm", left: "14mm" },
    });

    await browser.close();

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${title}.pdf"`);
    res.end(pdfBuffer);
  } catch (err) {
    console.error("PDF export error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "PDF export failed" }));
  }
};
