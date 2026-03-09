import { NextRequest } from "next/server";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOTAL_TIMEOUT_MS = 60_000;
const PAGE_TIMEOUT_MS = 60_000;
const TOP_VIOLATIONS_LIMIT = 10;

// Simple SSRF guard (keep yours if you want)
function isUrlAllowed(urlStr: string): boolean {
  try {
    const u = new URL(urlStr.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;

    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") return false;
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
    return Response.json({ error: "Invalid url" }, { status: 400 });
  }

  const refs: { browser: Browser | null; context: BrowserContext | null; page: Page | null } = {
    browser: null,
    context: null,
    page: null,
  };

  const runAudit = async () => {
    refs.browser = await chromium.launch({ headless: true });

    refs.context = await refs.browser.newContext({
      bypassCSP: true,
      ignoreHTTPSErrors: true,
    });

    refs.page = await refs.context.newPage();

    await refs.page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });

    // Small delay for SPA hydration
    await refs.page.waitForTimeout(800);

    // Inject axe from CDN (avoids Turbopack/module issues)
    await refs.page.addScriptTag({
      url: "https://unpkg.com/axe-core@4.10.2/axe.min.js",
    });

    // Confirm it exists
    const hasAxe = await refs.page.evaluate(() => typeof (window as any).axe !== "undefined");
    if (!hasAxe) throw new Error("axe not injected");

    // Run axe
    const results = await refs.page.evaluate(async () => {
      const w: any = window as any;
      return await w.axe.run(document);
    });

    const violations = results?.violations ?? [];
    const topViolations = violations.slice(0, TOP_VIOLATIONS_LIMIT).map((v: any) => ({
      id: v.id,
      impact: v.impact ?? null,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: Array.isArray(v.nodes) ? v.nodes.length : 0,
    }));

    return Response.json({
      url,
      a11y: {
        violationsCount: violations.length,
        topViolations,
      },
    });
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), TOTAL_TIMEOUT_MS)
  );

  try {
    return await Promise.race([runAudit(), timeoutPromise]);
  } catch (err: any) {
    return Response.json(
      { error: "Audit failed", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  } finally {
    if (refs.page) await refs.page.close().catch(() => {});
    if (refs.context) await refs.context.close().catch(() => {});
    if (refs.browser) await refs.browser.close().catch(() => {});
  }
}