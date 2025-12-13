/* ===========================================================================================
   BLOCK X: Server-side PDF export (Vercel Function)  (START)
   Goal:
   - POST HTML -> returns a downloadable PDF
   - Works on mobile/desktop because the PDF is generated on the server
   - Uses puppeteer-core + @sparticuz/chromium for Vercel compatibility
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
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    // Vercel parses JSON automatically when Content-Type: application/json
    const body = req.body || {};
    const html = String(body.html || "");
    const title = String(body.title || "export");

    if (!html.trim()) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing html" }));
      return;
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Load the HTML (this is what will be printed)
    await page.setContent(html, { waitUntil: ["load", "networkidle0"] });

    // Make sure background colors/highlights print when they exist in the HTML/CSS
    const pdfBuffer = await page.pdf({
      format: "letter",          // change to "a4" if you want
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "14mm", right: "14mm", bottom: "14mm", left: "14mm" },
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

/* ================================= BLOCK X (END) ======================================= */
