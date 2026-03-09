// app/api/synthesize/route.ts
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import { chromium, type Page } from "playwright";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type A11yTopViolation = {
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: number;
};

type AuditResponse = {
  url: string;
  context?: string;
  stage?: string;
  a11y: {
    violationsCount: number;
    topViolations: A11yTopViolation[];
  };
};

type SynthesisResponse = {
  summary: string[];
  topRisks: string[];
  quickWins: string[];
  decision: "ship" | "caution" | "do_not_ship";
  decisionReason: string;
  screenshots?: {
    desktop?: string;
    mobile?: string;
    folded?: string;
  };
  debugSource?: string;
};

type CapturedShots = {
  desktop: string;
  mobile: string;
  folded: string;
  desktopDataUrl: string;
  mobileDataUrl: string;
  foldedDataUrl: string;
  domSnapshot: any;
};

function safeJson(data: unknown) {
  return JSON.stringify(data ?? {}, null, 2);
}

function safeImpact(x: A11yTopViolation) {
  return (x.impact ?? "minor").toLowerCase();
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "site";
  }
}

function cleanText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function minimalFallback(): SynthesisResponse {
  return {
    summary: ["No data to analyze."],
    topRisks: ["Unable to run GPT analysis."],
    quickWins: ["Try again in a moment."],
    decision: "caution",
    decisionReason: "GPT analysis failed, showing fallback output.",
    screenshots: {},
    debugSource: "minimalFallback",
  };
}

function fallbackFromA11y(body: AuditResponse): SynthesisResponse {
  const v = body.a11y?.topViolations ?? [];

  const critical = v.filter((x) => safeImpact(x) === "critical").length;
  const serious = v.filter((x) => safeImpact(x) === "serious").length;
  const moderate = v.filter((x) => safeImpact(x) === "moderate").length;
  const minor = v.filter((x) => safeImpact(x) === "minor").length;

  const score =
    100 -
    Math.min(critical, 3) * 12 -
    Math.min(serious, 4) * 7 -
    Math.min(moderate, 5) * 4 -
    Math.min(minor, 5) * 2;

  const clampedScore = Math.max(30, score);

  const decision: SynthesisResponse["decision"] =
    critical > 0 || clampedScore < 60
      ? "do_not_ship"
      : serious > 0 || clampedScore < 80
        ? "caution"
        : "ship";

  const decisionReason =
    decision === "do_not_ship"
      ? "There are major issues that should be fixed before release."
      : decision === "caution"
        ? "There are important issues to improve, but they look fixable."
        : "Only smaller issues were found, so overall risk looks low.";

  const order: Record<string, number> = {
    critical: 0,
    serious: 1,
    moderate: 2,
    minor: 3,
  };

  const sorted = [...v].sort(
    (a, b) => (order[safeImpact(a)] ?? 9) - (order[safeImpact(b)] ?? 9)
  );

  return {
    summary: [
      "Desktop: Full GPT review was not available, so this is a fallback summary.",
      "Mobile: Full GPT review was not available, so this is a fallback summary.",
      `Shared: Approximate score is ${clampedScore}/100, with ${
        body.a11y?.violationsCount ?? v.length
      } issues found. The biggest issue detected was ${
        sorted[0]?.id ?? "unknown"
      }.`,
    ],
    topRisks: [
      "Some users may struggle to understand buttons, links, or form fields.",
      "Some parts of the page may be difficult to navigate with screen readers or keyboard-only navigation.",
      "Low text contrast or unclear structure may reduce readability and usability.",
    ],
    quickWins: [
      "Add clear labels to icon buttons and form fields.",
      "Improve contrast on important text and controls.",
      "Make the main content and navigation areas easier to understand.",
    ],
    decision,
    decisionReason,
    screenshots: {},
    debugSource: "fallbackFromA11y",
  };
}

function normalizeParsed(raw: any): SynthesisResponse {
  const normalizeStringList = (x: any): string[] => {
    if (Array.isArray(x)) {
      return x
        .map((item: any) => {
          if (typeof item === "string") return item.trim();

          if (item && typeof item === "object") {
            return [
              typeof item.issue === "string" ? item.issue : null,
              typeof item.fix === "string" ? item.fix : null,
              typeof item.location === "string"
                ? `Location: ${item.location}`
                : null,
              typeof item.description === "string" ? item.description : null,
              typeof item.benefit === "string"
                ? `Benefit: ${item.benefit}`
                : null,
              typeof item.recommendation === "string"
                ? `Fix: ${item.recommendation}`
                : null,
            ]
              .filter(Boolean)
              .join(". ");
          }

          return "";
        })
        .filter(Boolean);
    }

    if (typeof x === "string" && x.trim()) {
      return x
        .split(/\n+|(?<=\.)\s+(?=[A-Z])/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return [];
  };

  const safeDecision = (x: any): SynthesisResponse["decision"] =>
    x === "ship" || x === "caution" || x === "do_not_ship" ? x : "caution";

  return {
    summary: normalizeStringList(raw?.summary),
    topRisks: normalizeStringList(raw?.topRisks),
    quickWins: normalizeStringList(raw?.quickWins),
    decision: safeDecision(raw?.decision),
    decisionReason:
      typeof raw?.decisionReason === "string" ? raw.decisionReason : "",
    screenshots: {
      desktop:
        typeof raw?.screenshots?.desktop === "string"
          ? raw.screenshots.desktop
          : undefined,
      mobile:
        typeof raw?.screenshots?.mobile === "string"
          ? raw.screenshots.mobile
          : undefined,
      folded:
        typeof raw?.screenshots?.folded === "string"
          ? raw.screenshots.folded
          : undefined,
    },
  };
}

async function captureDomSnapshot(page: Page) {
  return page.evaluate(() => {
    const clean = (s: string) => (s || "").replace(/\s+/g, " ").trim();

    const isVisible = (el: Element) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      const style = window.getComputedStyle(el as HTMLElement);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };

    const title = clean(document.title || "");
    const metaDescription = clean(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content") || ""
    );

    const headings = Array.from(document.querySelectorAll("h1,h2,h3"))
      .filter(isVisible)
      .slice(0, 40)
      .map((h) => ({
        level: h.tagName.toLowerCase(),
        text: clean(h.textContent || ""),
      }))
      .filter((h) => h.text.length > 0);

    const landmarks = {
      header: document.querySelectorAll("header").length,
      nav: document.querySelectorAll("nav").length,
      main: document.querySelectorAll("main").length,
      footer: document.querySelectorAll("footer").length,
      aside: document.querySelectorAll("aside").length,
    };

    const getAriaLabel = (el: Element) =>
      clean((el as HTMLElement).getAttribute("aria-label") || "");

    const buttons = Array.from(
      document.querySelectorAll(
        "button,[role='button'],input[type='button'],input[type='submit']"
      )
    )
      .filter(isVisible)
      .slice(0, 40)
      .map((b) => ({
        text: clean((b as HTMLElement).textContent || ""),
        ariaLabel: getAriaLabel(b),
        type: (b as HTMLInputElement).type || "",
      }))
      .filter((b) => b.text || b.ariaLabel);

    const links = Array.from(document.querySelectorAll("a"))
      .filter(isVisible)
      .slice(0, 50)
      .map((a) => ({
        text: clean(a.textContent || ""),
        ariaLabel: getAriaLabel(a),
        href: (a as HTMLAnchorElement).getAttribute("href") || "",
      }))
      .filter((a) => a.text || a.ariaLabel);

    const inputs = Array.from(document.querySelectorAll("input,select,textarea"))
      .filter(isVisible)
      .slice(0, 40)
      .map((el) => {
        const id = (el as HTMLElement).id || "";
        const name = (el as HTMLInputElement).name || "";
        const placeholder = (el as HTMLInputElement).placeholder || "";
        const ariaLabel = getAriaLabel(el);

        const label = id
          ? clean(
              document.querySelector(`label[for="${CSS.escape(id)}"]`)
                ?.textContent || ""
            )
          : "";

        return {
          tag: el.tagName.toLowerCase(),
          type: (el as HTMLInputElement).type || "",
          name,
          id,
          label,
          placeholder: clean(placeholder),
          ariaLabel,
        };
      });

    const visibleTextBlocks = Array.from(
      document.querySelectorAll("section, article, div, li")
    )
      .filter(isVisible)
      .map((el) => clean(el.textContent || ""))
      .filter((text) => text.length > 20 && text.length < 200)
      .slice(0, 30);

    const imagesMissingAlt = Array.from(document.querySelectorAll("img"))
      .filter(isVisible)
      .filter((img) => !(img.getAttribute("alt") || "").trim())
      .slice(0, 15)
      .map((img) => ({ src: img.getAttribute("src") || "" }));

    return {
      title,
      metaDescription,
      landmarks,
      headings,
      buttons,
      links,
      inputs,
      visibleTextBlocks,
      imagesMissingAlt,
    };
  });
}

async function waitForStablePage(page: Page) {
  await page.waitForTimeout(1500);

  await page.waitForLoadState("networkidle").catch(() => {});

  await page
    .waitForFunction(
      () => {
        const loadingEl =
          document.querySelector('[class*="skeleton"]') ||
          document.querySelector('[class*="shimmer"]') ||
          document.querySelector('[aria-busy="true"]') ||
          document.querySelector('[data-loading="true"]');

        const hasRealContent =
          document.querySelector("h1, h2, main, article, button, img, a") !==
          null;

        return hasRealContent && !loadingEl;
      },
      { timeout: 8000 }
    )
    .catch(() => {});

  await page.waitForTimeout(1000);
}

async function captureScreenshots(url: string): Promise<CapturedShots> {
  console.log("[shots] start", url);

  const browser = await chromium.launch({ headless: true });

  try {
    const shotsDir = path.join(process.cwd(), "public", "debug-shots");
    await fs.mkdir(shotsDir, { recursive: true });

    const safeName = safeHost(url).replace(/[^a-z0-9.-]/gi, "_");
    const stamp = Date.now();

    const desktopPage = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await desktopPage.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await waitForStablePage(desktopPage);

    const domSnapshot = await captureDomSnapshot(desktopPage);

    const desktopBuf = await desktopPage.screenshot({
      fullPage: false,
      type: "png",
    });
    await desktopPage.close();

    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await mobilePage.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await waitForStablePage(mobilePage);

    const mobileBuf = await mobilePage.screenshot({
      fullPage: false,
      type: "png",
    });
    await mobilePage.close();

    const foldedPage = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await foldedPage.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await waitForStablePage(foldedPage);

    await foldedPage.evaluate(() => {
      window.scrollTo(0, Math.max(0, window.innerHeight * 0.9));
    });
    await foldedPage.waitForTimeout(500);

    const foldedBuf = await foldedPage.screenshot({
      fullPage: false,
      type: "png",
    });
    await foldedPage.close();

    const desktopFile = `${safeName}-${stamp}-desktop.png`;
    const mobileFile = `${safeName}-${stamp}-mobile.png`;
    const foldedFile = `${safeName}-${stamp}-folded.png`;

    await fs.writeFile(path.join(shotsDir, desktopFile), desktopBuf);
    await fs.writeFile(path.join(shotsDir, mobileFile), mobileBuf);
    await fs.writeFile(path.join(shotsDir, foldedFile), foldedBuf);

    console.log("[shots] ok", {
      desktop: desktopBuf.length,
      mobile: mobileBuf.length,
      folded: foldedBuf.length,
      desktopFile,
      mobileFile,
      foldedFile,
    });

    return {
      desktop: `/debug-shots/${desktopFile}`,
      mobile: `/debug-shots/${mobileFile}`,
      folded: `/debug-shots/${foldedFile}`,
      desktopDataUrl: `data:image/png;base64,${desktopBuf.toString("base64")}`,
      mobileDataUrl: `data:image/png;base64,${mobileBuf.toString("base64")}`,
      foldedDataUrl: `data:image/png;base64,${foldedBuf.toString("base64")}`,
      domSnapshot,
    };
  } finally {
    await browser.close();
  }
}

export async function POST(req: Request) {
  let body: AuditResponse | null = null;
  let shots: CapturedShots | null = null;

  const attachShots = (result: SynthesisResponse): SynthesisResponse => {
    if (shots) {
      result.screenshots = {
        desktop: shots.desktop,
        mobile: shots.mobile,
        folded: shots.folded,
      };
    }
    return result;
  };

  try {
    body = (await req.json()) as AuditResponse;
  } catch {
    return Response.json(attachShots(minimalFallback()), { status: 200 });
  }

  try {
    if (!body?.url) {
      return Response.json(attachShots(minimalFallback()), { status: 200 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(attachShots(fallbackFromA11y(body)), {
        status: 200,
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
      shots = await captureScreenshots(body.url);
    } catch (e) {
      console.error("[shots] failed", e);
      shots = null;
    }

    const system = [
      "You are reviewing a website audit and turning it into a clear UX and UI summary.",
      "Your audience includes designers, product managers, developers, marketing, operations, and leadership.",
      "Many readers are not UX or accessibility experts.",
      "Your job is to explain problems in simple, practical language that anyone in a company can understand.",
      "",
      "Main goal:",
      "Explain what feels unclear, hard to use, hard to read, easy to miss, visually dense, or confusing.",
      "Focus on the user experience first, not on technical compliance terms.",
      "",
      "Important rules:",
      "1. Focus on real UX and UI problems users experience on the screen.",
      "2. Prefer visible interface language over technical language.",
      "3. Avoid technical accessibility jargon.",
      "4. Do not use terms like ARIA, DOM, WCAG, semantic roles, landmarks, accessibility tree, parent-child role, or similar unless absolutely necessary.",
      "5. If a technical concept must appear, explain it in plain language right away.",
      "6. Start sentences with the visible UI element whenever possible.",
      "7. Prefer phrases like 'search field', 'top navigation', 'main betting table', 'left menu', 'right panel', 'icon button', 'odds list', 'category tabs', 'footer links'.",
      "8. Avoid abstract phrasing like 'users may struggle' unless the visible UI element is mentioned first.",
      "9. Each bullet should describe a visible issue and why it matters.",
      "10. Use slightly descriptive explanations, around one or two sentences per bullet.",
      "11. Keep the writing concise, but do not make it too short or vague.",
      "12. Avoid sounding like a compliance report.",
      "13. Avoid repeating the same issue in different words.",
      "14. Prioritize the biggest UX issues first: unclear navigation, unlabeled controls, dense layouts, confusing content, weak readability, unclear hierarchy, poor discoverability, or missing explanations.",
      "15. When several issues are similar, merge them into one stronger point instead of listing near-duplicates.",
      "",
      "Good style examples:",
      "The search field does not have a visible label explaining its purpose, which can make it confusing for users who rely on screen readers.",
      "The top navigation uses icons and short labels, but some controls do not clearly explain what they do, which reduces clarity for new users.",
      "The main betting table shows many numbers and abbreviations without enough explanation, which can overwhelm less experienced users.",
      "The yellow odds text against the dark background is visually striking, but some smaller text nearby is harder to read at a glance.",
      "",
      "Bad style examples:",
      "ARIA roles are misconfigured.",
      "DOM landmarks duplicated.",
      "WCAG violations detected.",
      "Users may struggle.",
      "",
      "When screenshots exist, analyze desktop and mobile separately.",
      "Do not combine desktop and mobile issues into one sentence.",
      "Mention visible UI areas like header, hero banner, search panel, filters, buttons, cards, navigation, footer, or side panels.",
      "Use position descriptions such as top-left logo, top-right search panel, center content area, right-side panel, or footer icons when helpful.",
      "Point to visible UI elements whenever possible.",
      "",
      "Output quality boost:",
      "Before writing, identify the 3 to 5 most important user-facing problems visible in the screenshots and supported by the audit data.",
      "Then write the summary around those strongest problems instead of trying to mention every technical finding.",
      "Prefer quality over coverage. Stronger, clearer insights are better than longer noisy lists.",
      "Avoid repeating the same issue in different words.",
      "If several issues describe the same problem, for example missing labels or unclear buttons, merge them into one stronger insight instead of repeating similar points.",
      "Prefer fewer, clearer insights over long repetitive lists.",
      "When possible, frame problems using the visible product feature first, such as navigation, betting table, odds list, filters, chat icon, instead of accessibility terminology.",
      "",
      "Return only valid JSON.",
      "No markdown.",
      'Use decision in ["ship","caution","do_not_ship"].',
      "Use this exact structure:",
      '{ "summary": string[], "topRisks": string[], "quickWins": string[], "decision": string, "decisionReason": string }',
      "summary, topRisks and quickWins must always be arrays of plain strings.",
      "Do not return objects inside those arrays.",
      "",
      "Summary rules:",
      "Each summary item must start with one of these prefixes so the UI can group them:",
      "Desktop:",
      "Mobile:",
      "Shared:",
      "",
      "Top risks rules:",
      "Write the biggest user or business risks in plain language.",
      "These should explain what could go wrong for users, such as confusion, missed actions, bad readability, weak discoverability, or high effort to understand the page.",
      "",
      "Quick wins rules:",
      "Write practical fixes in plain language.",
      "Focus on actions a product, design, or development team can actually take quickly.",
      "",
      "Decision rules:",
      "ship = issues are minor",
      "caution = important issues but fixable without redesign",
      "do_not_ship = serious usability or accessibility blockers",
      "",
      "Keep writing clear, practical, descriptive, product-focused, and easy for non-experts to understand.",
    ].join("\n");

    const domText = shots?.domSnapshot
      ? `\nDOM snapshot (text only):\n${safeJson(shots.domSnapshot)}\n`
      : "";

    const userText = [
      "Audit context:",
      `URL: ${body.url}`,
      `Stage: ${body.stage ?? "unknown"}`,
      `Feature context: ${body.context ?? "none provided"}`,
      "",
      "Important instructions:",
      "Desktop and mobile screenshots are provided separately.",
      "Describe desktop problems using the desktop screenshot.",
      "Describe mobile problems using the mobile screenshot.",
      "If an issue exists on both, explicitly say it affects both desktop and mobile.",
      "Use screenshots to identify specific UI areas when possible.",
      "Mention locations such as header, top navigation, search field, buttons, dropdowns, filters, cards, tabs, side panels, betting table, or footer.",
      "Translate technical scan results into practical UI feedback.",
      "Write feedback that product managers, developers, office managers, and non-design stakeholders can easily understand.",
      "Do not only restate scan rules. Explain what the issue means for a real user.",
      "Prefer screen readers over assistive technology when possible.",
      "Prefer main content area over landmarks.",
      "Prefer clear label or text description over aria-label unless necessary.",
      "",
      "Accessibility scan results:",
      safeJson(body.a11y),
      domText,
      "Return JSON with:",
      "- summary as an array of simple, descriptive review points",
      "- topRisks as an array of simple, concrete risk statements",
      "- quickWins as an array of simple, practical fixes",
      "- decision",
      "- decisionReason (1 sentence)",
    ]
      .map((x) => cleanText(x))
      .filter(Boolean)
      .join("\n");

    const userMessage = shots
      ? {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "text", text: "Screenshot 1: Desktop (above the fold)" },
            { type: "image_url", image_url: { url: shots.desktopDataUrl } },
            { type: "text", text: "Screenshot 2: Mobile (above the fold)" },
            { type: "image_url", image_url: { url: shots.mobileDataUrl } },
            { type: "text", text: "Screenshot 3: Desktop (scrolled or folded)" },
            { type: "image_url", image_url: { url: shots.foldedDataUrl } },
          ],
        }
      : { role: "user", content: userText };

    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        userMessage as any,
      ] as any,
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0]?.message?.content ?? "{}";
    console.log("[synth] raw content", content);

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("[synth] parse failed", e);
      return Response.json(attachShots(fallbackFromA11y(body)), {
        status: 200,
      });
    }

    const normalized = attachShots(normalizeParsed(parsed));
    normalized.debugSource = "gpt";

    console.log("[synth] normalized", normalized);

    const hasBasics =
      normalized.summary.length > 0 &&
      normalized.topRisks.length > 0 &&
      normalized.quickWins.length > 0 &&
      normalized.decisionReason.length > 0;

    const result = hasBasics
      ? normalized
      : attachShots(fallbackFromA11y(body));

    return Response.json(result, { status: 200 });
  } catch (e) {
    console.error("[synth] outer failed", e);
    const fallback = body?.url ? fallbackFromA11y(body) : minimalFallback();
    return Response.json(attachShots(fallback), { status: 200 });
  }
}