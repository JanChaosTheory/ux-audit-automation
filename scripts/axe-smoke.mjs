import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const url = process.argv[2] || "https://example.com";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();   // <-- required
  const page = await context.newPage();         // <-- use context

  console.log("Opening:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  const results = await new AxeBuilder({ page }).analyze();

  console.log("Violations:", results.violations.length);

  results.violations.slice(0, 10).forEach((v, i) => {
    console.log(`\n${i + 1}. ${v.id} (${v.impact})`);
    console.log(v.description);
    console.log("Nodes:", v.nodes.length);
  });

  await browser.close();
})();