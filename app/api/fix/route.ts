import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FixRequest = {
  issue?: string;
  url?: string;
  context?: string;
};

type FixResponse = {
  prompt: string;
  source: "gpt" | "fallback";
};

function cleanText(value: string | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function buildFallbackPrompt({
  issue,
  url,
  context,
}: {
  issue: string;
  url: string;
  context?: string;
}) {
  return [
    "You are a senior UX engineer and front-end product designer.",
    "",
    "A usability issue was identified on this page.",
    "",
    `Page URL: ${url}`,
    context ? `Context: ${context}` : null,
    `Issue to fix: ${issue}`,
    "",
    "Your task:",
    "- Propose a practical fix for this issue",
    "- Improve usability and accessibility",
    "- Avoid a full redesign unless absolutely necessary",
    "- Keep the solution realistic for a product team to implement",
    "",
    "Please provide:",
    "1. A short explanation of what should change",
    "2. Specific UI or interaction changes to make",
    "3. Any accessibility improvements that should be included",
    "4. Optional example implementation notes if useful",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FixRequest;

    const issue = cleanText(body.issue);
    const url = cleanText(body.url);
    const context = cleanText(body.context);

    if (!issue || !url) {
      return Response.json(
        { error: "Missing required fields: issue and url." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          prompt: buildFallbackPrompt({ issue, url, context }),
          source: "fallback",
        } satisfies FixResponse,
        { status: 200 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const system = [
      "You write concise, practical fix prompts for AI coding tools.",
      "Your output will be copied by a product manager, designer, or engineer into tools like Cursor, Claude, or ChatGPT.",
      "Write a prompt that helps implement a fix for one specific UX issue.",
      "Keep the prompt practical, clear, and implementation-oriented.",
      "Do not write a solution directly.",
      "Do not explain your reasoning.",
      "Return only valid JSON.",
      'Use this exact structure: { "prompt": string }',
    ].join("\n");

    const user = [
      "Create a prompt for fixing this UX issue.",
      `URL: ${url}`,
      context ? `Context: ${context}` : null,
      `Issue: ${issue}`,
      "",
      "The generated prompt should:",
      "- ask for a practical UX/UI fix",
      "- improve accessibility where relevant",
      "- avoid unnecessary redesign",
      "- be useful for implementation in AI coding tools",
      "- be specific enough to produce a good result",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";

    try {
      const parsed = JSON.parse(content);
      const prompt =
        typeof parsed?.prompt === "string" && parsed.prompt.trim()
          ? parsed.prompt.trim()
          : buildFallbackPrompt({ issue, url, context });

      return Response.json(
        {
          prompt,
          source: "gpt",
        } satisfies FixResponse,
        { status: 200 }
      );
    } catch {
      return Response.json(
        {
          prompt: buildFallbackPrompt({ issue, url, context }),
          source: "fallback",
        } satisfies FixResponse,
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("[fix] failed", error);

    return Response.json(
      { error: "Failed to generate fix prompt." },
      { status: 500 }
    );
  }
}