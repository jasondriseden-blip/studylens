// api/ocr.js
// OCR endpoint for StudyLens on Vercel.
// Uses OpenAI vision (Chat Completions with image_url).
// Requires: process.env.OPENAI_API_KEY

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Same model picker as solve.js – you can keep them in sync if you like.
function pickOpenAIModel(modelChoice) {
  if (!modelChoice || modelChoice === "smart" || modelChoice === "openai") {
    // Needs a multimodal model (text + image input)
    return "gpt-4.1-mini";
  }
  return "gpt-4.1-mini";
}

async function callOpenAIOCR({ prompt, imageData, modelChoice }) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }

  const model = pickOpenAIModel(modelChoice);

  // Fallback prompt if frontend didn’t send one for some reason
  const userTextPrompt =
    prompt && typeof prompt === "string" && prompt.trim().length
      ? prompt
      : "Extract the text from this homework image and return plain text only.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an OCR helper. Return ONLY the raw text you see in the image. " +
            "Do not add explanations, comments, or formatting beyond line breaks.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userTextPrompt,
            },
            {
              // Frontend sends a data URL, which OpenAI supports directly
              type: "image_url",
              image_url: {
                url: imageData,
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 1200,
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
    "[No OCR text returned from model]";

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

  const { prompt, imageData, model } = body || {};

  if (!imageData || typeof imageData !== "string") {
    return res
      .status(400)
      .json({ error: "Missing or invalid `imageData` (data URL expected)." });
  }

  try {
    const text = await callOpenAIOCR({
      prompt,
      imageData,
      modelChoice: model,
    });

    return res.status(200).json({ text });
  } catch (err) {
    console.error("ocr.js error:", err);
    return res.status(500).json({
      error: err.message || "Unknown server error",
    });
  }
};
