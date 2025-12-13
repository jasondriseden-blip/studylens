/* ===========================================================================================
   BLOCK X: Server-side PDF export (Vercel Function) (START)
   Goal:
   - POST { title, html, text } -> returns application/pdf
   - Uses puppeteer-core + @sparticuz/chromium (Vercel-safe)
   - Prints backgrounds (so highlights can show if they exist in HTML/CSS)
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

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtmlDocument({ title, innerHtml, fallbackText }) {
  // IMPORTANT:
  // - We remove the tool-output border/background for the PDF
  // - We keep printBackground=true in puppeteer so highlights can show
  const safeTitle = String(title || "Export").replace(/</g, "&lt;");

  const bodyBlock = (innerHtml && String(innerHtml).trim())
    ? `<div class="tool-output"><div class="tool-output-body">${innerHtml}</div></div>`
    : `<div class="tool-output"><pre class="tool-output-body">${escapeHtml(fallbackText)}</pre></div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <style>
    /* Page */
    @page { margin: 14mm; }
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }

    /* Output styling for print */
    .tool-output {
      border: none !important;
      background: transparent !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
    }
    .tool-output-body {
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      font-size: 12.5pt;
      line-height: 1.5;
    }
    pre.tool-output-body {
      margin: 0;
      font: inherit;
    }

    /* If your highlights are <mark> tags, this helps */
    mark { background: #fff59d; padding: 0 0.08em; }

    /* If your highlights are spans with inline background-color, printBackground will handle it */
  </style>
</head>
<body>
  ${bodyBlock}
</body>
</html>`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let browser = null;

  try {
    // Vercel usually parses JSON into req.body, but be defensive:
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const title = String(body.title || "export");
    const innerHtml = String(body.html || "");
    const text = String(body.text || "");

    if (!innerHtml.trim() && !text.trim()) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Nothing to export (missing html/text)" }));
      return;
    }

    const htmlDoc = buildHtmlDocument({
      title,
      innerHtml,
      fallbackText: text,
    });

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setContent(htmlDoc, { waitUntil: ["load", "networkidle0"] });

    const pdfBuffer = await page.pdf({
      format: "letter",              // change to "a4" if you want
      printBackground: true,         // REQUIRED for highlight backgrounds
      preferCSSPageSize: true,
      margin: { top: "14mm", right: "14mm", bottom: "14mm", left: "14mm" },
    });

    const filename = safeFilename(title);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(pdfBuffer);
  } catch (err) {
    console.error("PDF export error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "PDF export failed", detail: String(err && err.message ? err.message : err) }));
  } finally {
    try {
      if (browser) await browser.close();
    } catch (_) {}
  }
};

/* ================================= BLOCK X (END) ======================================= */
