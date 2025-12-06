// api/solve.js
// Text-only StudyLens backend for Vercel Serverless Functions.
// Uses OpenAI Chat Completions via fetch.
// Requires: process.env.OPENAI_API_KEY

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Simple mapping from UI "model" selector to OpenAI model ID
function pickOpenAIModel(modelChoice) {
  // "smart" and "openai" both go to a solid default model.
  if (!modelChoice || modelChoice === "smart" || modelChoice === "openai") {
    return "gpt-4.1-mini";
  }

  // You can customize more branches here if you add other providers/models.
  return "gpt-4.1-mini";
}

async function callOpenAIChat({ prompt, modelChoice, task }) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }

  const model = pickOpenAIModel(modelChoice);

  const systemPrompt =
    "You are StudyLens, a friendly AI study helper for middle and high school students. " +
    "Explain things clearly and avoid over-complicated notation.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          // `prompt` already includes Mode / Subject / Tool from the frontend.
          content: prompt,
        },
      ],
      temperature: task === "math" ? 0.1 : 0.3,
      max_tokens: 900,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message || `OpenAI API error (status ${response.status})`;
    throw new Error(message);
  }

  const text =
    data.choices?.[0]?.message?.content?.trim() ||
    "[No content returned from model]";

  return text;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      // leave as string; will fail below
    }
  }

  const { prompt, task, model } = body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing or invalid `prompt`." });
  }

  try {
    const text = await callOpenAIChat({
      prompt,
      modelChoice: model,
      task,
    });

    return res.status(200).json({ text });
  } catch (err) {
    console.error("solve.js error:", err);
    return res.status(500).json({
      error: err.message || "Unknown server error",
    });
  }
};
