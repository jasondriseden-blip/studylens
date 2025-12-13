/* ===========================================================================================
   BLOCK X: Server-side PDF export (Vercel Function) (START)
   Goal:
   - POST HTML -> returns a downloadable PDF
   - Server-generated PDF works on mobile/desktop (no window.print)
   - Uses puppeteer-core + @sparticuz/chromium for Vercel
=========================================================================================== */

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

function safeFilename(name) {
  const base = String(name || "export")
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return (base || "export") + ".pdf";
}

module.exports = async (req, res) => {
  // Always return JSON/PDF — never crash the runtime
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    // Vercel may give body as object OR string depending on setup
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const htmlInner = String(body.html || "");
    const title = String(body.title || "export");

    if (!htmlInner.trim()) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing html" }));
      return;
    }

    // Wrap in a full HTML document (puppeteer prefers complete docs)
    const fullHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title.replace(/</g, "&lt;")}</title>
  <style>
    body { margin: 0; padding: 14mm; }
    /* remove any borders/boxes from your tool container in the PDF */
    .tool-output { border: none !important; background: transparent !important; padding: 0 !important; box-shadow: none !important; }
    .tool-output-body { white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="tool-output">
    <div class="tool-output-body">${htmlInner}</div>
  </div>
</body>
</html>`;

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: ["load", "networkidle0"] });

    const pdfBuffer = await page.pdf({
      format: "letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    await browser.close();

    const filename = safeFilename(title);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(pdfBuffer);
  } catch (err) {
    console.error("PDF export error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "PDF export failed" }));
  }
};

/* ================================== BLOCK X (END) ======================================= */
