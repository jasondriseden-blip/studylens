/* ===========================================================================================
   BLOCK X: Server-side PDF export (Vercel Function)  (START)
   Goal:
   - POST { title, html, text } -> returns application/pdf
   - Works on mobile/desktop (server-generated PDF)
   - Fixes libnss3.so missing by setting LD_LIBRARY_PATH for Sparticuz Chromium
   Route:
   - /api/export-pdf   (because this file is: /api/export-pdf.js)
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

async function readJsonBody(req) {
  // If something already parsed it:
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function ensureChromiumLibs() {
  // ✅ Fix for: libnss3.so: cannot open shared object file
  const addPath = "/tmp/al2/lib";
  const cur = process.env.LD_LIBRARY_PATH || "";
  if (!cur.includes(addPath)) {
    process.env.LD_LIBRARY_PATH = cur ? `${cur}:${addPath}` : addPath;
  }
  // Helps fonts render more consistently
  process.env.FONTCONFIG_PATH = "/tmp/fonts";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    ensureChromiumLibs();

    const body = await readJsonBody(req);
    const title = String(body.title || "export");
    const htmlInner = String(body.html || "");
    const textFallback = String(body.text || "");

    if (!htmlInner.trim() && !textFallback.trim()) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing html/text" }));
      return;
    }

    // Build a clean printable HTML doc.
    // Note: keeps inline formatting/highlights if they exist in htmlInner.
    const docHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  /* basic page */
  body { margin: 0; padding: 14mm; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
  /* remove any box/border if your html contains .tool-output wrapper */
  .tool-output { border: none !important; background: transparent !important; padding: 0 !important; box-shadow: none !important; margin: 0 !important; }
  .tool-output-header { display: none !important; } /* don’t print the Copy button area */
  .tool-output-body { white-space: pre-wrap; }
</style>
</head>
<body>
  ${
    htmlInner.trim()
      ? `<div class="tool-output"><div class="tool-output-body">${htmlInner}</div></div>`
      : `<pre class="tool-output-body" style="margin:0; white-space:pre-wrap;">${escapeHtml(textFallback)}</pre>`
  }
</body>
</html>`;

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(docHtml, { waitUntil: ["load", "networkidle0"] });

    const pdfBuffer = await page.pdf({
      format: "letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    await browser.close();

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(title)}"`);
    res.end(pdfBuffer);
  } catch (err) {
    console.error("PDF export error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "PDF export failed",
        detail: String(err && err.message ? err.message : err),
      })
    );
  }
};

/* ================================= BLOCK X (END) ======================================= */
