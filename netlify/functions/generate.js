// netlify/functions/generate.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Missing OPENAI_API_KEY" };
    }

    const userPayload = JSON.parse(event.body || "{}"); // { selections, exclusions, toggles }

    const system = `
You are a clinical, evidence-informed brain-healthy recipe generator for older adults.
Return: (1) a named recipe (serves 1–2), (2) ingredients with amounts,
(3) step-by-step directions, (4) a "Nutrition & Scores" table with columns:
| Ingredient | Calories | Protein (g) | Fiber (g) | GI | GL | Anti-Inflammatory/DII Score (lower is better) | Key Micronutrients | Microbiome Benefit Score |
(5) a brief coaching paragraph (professional, empowering).
Rules: Recipe FIRST, then table. Respect exclusions. Prefer MIND/Mediterranean patterns,
moderate sodium, high fiber. Wrap long header text so the table doesn’t widen.
Keep tone formal, clinical, supportive.
    `.trim();

    const user = `
Selections JSON:
${JSON.stringify(userPayload, null, 2)}

Please generate exactly 1 recipe. If few ingredients are provided, infer reasonable additions that fit constraints.
Ensure the table appears AFTER the recipe. Keep output compact and clean.
    `.trim();

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 500, body: `OpenAI error: ${errText}` };
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
