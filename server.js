// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---- Cleaning function: kill Markdown + LaTeX + junk HARD ----
function cleanLLMOutput(text) {
  if (!text) return "";

  // 1) Remove Markdown headings like "### a)" or "# Answer"
  text = text.replace(/^\s*#{1,6}\s+.*$/gm, "");

  // 2) Remove horizontal rules (---, ***, ___) anywhere
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, "");
  text = text.replace(/---/g, "");

  // 3) Remove code fences ```
  text = text.replace(/```/g, "");

  // 4) LaTeX \frac{a}{b}  ->  a/b
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2");

  // 5) LaTeX \sqrt{something} -> √(something)
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");

  // 6) Clean √(x) -> √x (simple case)
  text = text.replace(/√\(([^()]+)\)/g, "√$1");

  // 7) \boxed{...} -> ...
  text = text.replace(/\\boxed\{([^}]+)\}/g, "$1");

  // 8) Drop LaTeX math delimiters \( \) \[ \ ]
  text = text.replace(/\\\(|\\\)/g, "");
  text = text.replace(/\\\[|\\\]/g, "");

  // 9) Drop $$ and $...$
  text = text.replace(/\$\$/g, "");
  text = text.replace(/\$(.*?)\$/g, "$1");

  // 10) Common TeX operators
  text = text.replace(/\\times/g, "×");
  text = text.replace(/\\cdot/g, "·");

  // 11) Remove bullet-style "- something" or "* something" (but keep "-360")
  text = text.replace(/^\s*-\s+(?!\d)/gm, "");
  text = text.replace(/^\s*\*\s+(?!\d)/gm, "");

  // 12) Remove generic "Let's solve..." fluff line
  text = text.replace(/^Lets solve.*$/gmi, "");

  // 13) Remove ANY remaining backslashes, backticks, #, *, _, >, $ (nuke formatting)
  text = text.replace(/[\\`#*_$>]/g, "");

  // 14) Trim trailing spaces on each line
  text = text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  // 15) Collapse big gaps
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

// API route your front-end calls
app.post("/api/ai", async (req, res) => {
  try {
    const { prompt, task, modelChoice, subject } = req.body;

    const systemPrompt = `
You are StudyLens, an AI tutor for middle and high school students.

You MUST follow these formatting rules strictly:

- Use PLAIN TEXT ONLY.
- Do NOT use Markdown formatting (no headings, no bullet lists, no horizontal lines).
- Do NOT use LaTeX or TeX syntax (no \\sqrt{}, \\frac{}, \\boxed{}, \\( \\), \\[ \\], $$, etc.).
- Write math with normal characters like: √125, 3√2, 16/√32, (x + 3)^2, 2/3, -5x^2.
- Use short lines like:
  Step 1: ...
  Step 2: ...
- End with exactly one line:
  Final answer: <answer>
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    // Get raw text (whole first output block)
    const rawText =
      completion.output?.[0]?.content?.[0]?.text ||
      "Sorry, I couldn't generate a response.";

    const text = cleanLLMOutput(rawText);

    res.json({ text });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI error", detail: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`StudyLens backend running on port ${PORT}`);
});
