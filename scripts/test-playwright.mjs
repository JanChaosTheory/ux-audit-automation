import { chromium } from "playwright";

const url = process.argv[2] || "https://example.com";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log("Opening:", url);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  
  const title = await page.title();
  const h1Count = await page.locator("h1").count();
  const buttonCount = await page.locator("button").count();

  console.log("Title:", title);
  console.log("H1 count:", h1Count);
  console.log("Button count:", buttonCount);

  await browser.close();
})();