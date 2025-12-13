/* ===========================================================================================
   BLOCK X: Server-side PDF export (Vercel Function)  (START)
   Goal:
   - POST { title, html } -> returns a downloadable PDF
   - Reliable on mobile/desktop because PDF is generated server-side
   - Uses Browserless PDF API (supports sending raw HTML)
   What you must have:
   - Vercel env var: BROWSERLESS_TOKEN
=========================================================================================== */

function safeFilename(name) {
  const base = String(name || "export")
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return (base || "export") + ".pdf";
}

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const token = process.env.BROWSERLESS_TOKEN;
    if (!token) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing BROWSERLESS_TOKEN env var" }));
      return;
    }

    const body = req.body || {};
    const title = String(body.title || "export");
    const inner = String(body.html || "").trim();

    if (!inner) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing html" }));
      return;
    }

    // Wrap the incoming innerHTML into a full HTML doc.
    // Also: remove the tool-output border/background in the PDF.
    const fullHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    @page { margin: 14mm; }
    /* If your output includes .tool-output, strip the box for PDF */
    .tool-output { border: none !important; background: transparent !important; padding: 0 !important; box-shadow: none !important; margin: 0 !important; }
  </style>
</head>
<body>
  ${inner}
</body>
</html>`;

    // Browserless PDF API: send either { html } or { url } :contentReference[oaicite:1]{index=1}
    const endpoint = `https://production-sfo.browserless.io/pdf?token=${encodeURIComponent(token)}`;

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        html: fullHtml,
        options: {
          // printBackground=true keeps highlight backgrounds when they exist in HTML/CSS :contentReference[oaicite:2]{index=2}
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: "14mm", right: "14mm", bottom: "14mm", left: "14mm" },
        },
      }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Browserless PDF failed", detail: txt || `HTTP ${r.status}` }));
      return;
    }

    const pdfBuf = Buffer.from(await r.arrayBuffer());
    const filename = safeFilename(title);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(pdfBuf);
  } catch (err) {
    console.error("export-pdf error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "PDF export failed", detail: String(err && err.message ? err.message : err) }));
  }
};

/* ================================= BLOCK X (END) ======================================= */
