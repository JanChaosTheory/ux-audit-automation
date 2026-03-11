import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOP_VIOLATIONS_LIMIT = 10;
const PAGE_TIMEOUT_MS = 60000;
const AXE_CDN_URL = "https://unpkg.com/axe-core@4.10.2/axe.min.js";

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

async function getAxeSource() {
  const res = await fetch(AXE_CDN_URL, {
    cache: "force-cache",
  });

  if (!res.ok) {
    throw new Error(`Failed to download axe: ${res.status}`);
  }

  return await res.text();
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

  let desktopBrowser: any = null;
  let desktopContext: any = null;
  let desktopPage: any = null;

  let mobileBrowser: any = null;
  let mobileContext: any = null;
  let mobilePage: any = null;

  try {
    const axeSource = await getAxeSource();

    desktopBrowser = await chromium.connectOverCDP(wsEndpoint);

    desktopContext = await desktopBrowser.newContext({
      viewport: { width: 1440, height: 900 },
      bypassCSP: true,
      ignoreHTTPSErrors: true,
    });

    desktopPage = await desktopContext.newPage();

    await desktopPage.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS,
    });

    await desktopPage.waitForLoadState("networkidle").catch(() => {});
    await desktopPage.waitForTimeout(2500);

    const desktopScreenshot = await desktopPage.screenshot({
      type: "jpeg",
      quality: 60,
      fullPage: false,
    });

    const foldedScreenshot = await desktopPage.screenshot({
      type: "jpeg",
      quality: 60,
      fullPage: true,
    });

    await desktopPage.addScriptTag({
      content: axeSource,
    });

    const hasAxe = await desktopPage.evaluate(
      () => typeof (window as any).axe !== "undefined"
    );

    if (!hasAxe) {
      throw new Error("axe injection failed");
    }

    const results = await desktopPage.evaluate(async () => {
      const axeGlobal = (window as any).axe;
      return await axeGlobal.run(document);
    });

    mobileBrowser = await chromium.connectOverCDP(wsEndpoint);

    mobileContext = await mobileBrowser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      isMobile: true,
      hasTouch: true,
      bypassCSP: true,
      ignoreHTTPSErrors: true,
    });

    mobilePage = await mobileContext.newPage();

    await mobilePage.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS,
    });

    await mobilePage.waitForLoadState("networkidle").catch(() => {});
    await mobilePage.waitForTimeout(3000);

    const mobileScreenshot = await mobilePage.screenshot({
      type: "jpeg",
      quality: 60,
      fullPage: false,
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
      screenshots: {
        desktop: `data:image/jpeg;base64,${desktopScreenshot.toString("base64")}`,
        mobile: `data:image/jpeg;base64,${mobileScreenshot.toString("base64")}`,
        folded: `data:image/jpeg;base64,${foldedScreenshot.toString("base64")}`,
      },
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
    await mobilePage?.close().catch(() => {});
    await mobileContext?.close().catch(() => {});
    await mobileBrowser?.close().catch(() => {});

    await desktopPage?.close().catch(() => {});
    await desktopContext?.close().catch(() => {});
    await desktopBrowser?.close().catch(() => {});
  }
}