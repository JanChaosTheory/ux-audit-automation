import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOP_VIOLATIONS_LIMIT = 10;
const PAGE_TIMEOUT_MS = 60000;

function isUrlAllowed(urlStr: string): boolean {
  try {
    const u = new URL(urlStr.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;

    const host = u.hostname.toLowerCase();

    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1"
    ) {
      return false;
    }

    if (host.startsWith("10.")) return false;
    if (host.startsWith("192.168.")) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;

    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = (request.nextUrl.searchParams.get("url") ?? "").trim();

  if (!url || !isUrlAllowed(url)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const token = process.env.BROWSERLESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "Browserless token missing" },
      { status: 500 }
    );
  }

  const wsEndpoint = `wss://production-sfo.browserless.io?token=${token}`;

  let browser: any = null;
  let context: any = null;
  let page: any = null;

  try {
    browser = await chromium.connectOverCDP(wsEndpoint);

    context =
      browser.contexts()[0] ??
      (await browser.newContext({
        bypassCSP: true,
        ignoreHTTPSErrors: true,
      }));

    page = await context.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS,
    });

    await page.waitForTimeout(1000);

    await page.addScriptTag({
      url: "https://unpkg.com/axe-core@4.10.2/axe.min.js",
    });

    const results = await page.evaluate(async () => {
      const axe = (window as any).axe;
      return await axe.run(document);
    });

    const violations = results?.violations ?? [];

    const topViolations = violations
      .slice(0, TOP_VIOLATIONS_LIMIT)
      .map((v: any) => ({
        id: v.id,
        impact: v.impact ?? null,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes?.length ?? 0,
      }));

    return NextResponse.json({
      url,
      a11y: {
        violationsCount: violations.length,
        topViolations,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Audit failed", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  } finally {
    await page?.close().catch(() => {});
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}