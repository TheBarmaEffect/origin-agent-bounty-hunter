/**
 * Capture key UI moments as PNGs for the README.
 * Uses headless Chrome via puppeteer.
 *
 * Run: npx tsx scripts/captureScreenshots.ts
 *
 * Screenshots saved to docs/screenshots/.
 */
import puppeteer from "puppeteer";
import { resolve } from "path";

const URL = process.env.SCREENSHOT_URL || "http://localhost:5174/?mock=1";
const OUT = resolve(__dirname, "..", "docs", "screenshots");

async function shoot(page: any, name: string) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  ✅ ${name}.png`);
}

async function waitFor(page: any, fn: () => boolean, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await page.evaluate(fn);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  console.log(`Capturing from ${URL}...\n`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
    defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));

  console.log("Phase 1: Launcher");
  await shoot(page, "01-launcher");

  await page.click('button[type="submit"]');
  console.log("Clicked START BOUNTY");

  // Phase 2: Intro splash mid-sequence
  await new Promise((r) => setTimeout(r, 1300));
  await shoot(page, "02-intro-splash");

  // Phase 3: Arena mounted, agents running
  await waitFor(page, () => !!document.querySelector('header.glass'));
  await new Promise((r) => setTimeout(r, 4000));
  await shoot(page, "03-arena-running");

  // Phase 4: Mid-race with payment rail full
  await new Promise((r) => setTimeout(r, 5000));
  await shoot(page, "04-arena-payments");

  // Phase 5: Audit phase — agents scored, ranks settled
  await waitFor(page, () => {
    const cards = document.querySelectorAll('[class*="glow"]');
    return Array.from(cards).some(c => c.textContent?.includes('VIOLATION') || c.textContent?.includes('SCORED'));
  });
  await new Promise((r) => setTimeout(r, 2000));
  await shoot(page, "05-arena-audit");

  // Phase 6: Verdict overlay just opened (header banner + ORIGIN VERDICT)
  await waitFor(page, () => {
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    return !!overlay && !!document.body.innerText.match(/ORIGIN VERDICT/);
  });
  await new Promise((r) => setTimeout(r, 1800));
  await shoot(page, "06-verdict-reveal");

  // Phase 7: Wait for the OVERLAY's payout/winner — verdict text takes ~16s to type
  await waitFor(page, () => {
    // The overlay winner card has the giant Compass name with PAYOUT label
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    if (!overlay) return false;
    return !!overlay.textContent?.match(/PAYOUT/);
  }, 35000);
  await new Promise((r) => setTimeout(r, 800));
  await shoot(page, "07-verdict-winner");

  // Phase 8: Receipt bar fully visible
  await waitFor(page, () => {
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    if (!overlay) return false;
    return !!overlay.textContent?.match(/VERDICT HASH/);
  }, 15000);
  await new Promise((r) => setTimeout(r, 1200));
  await shoot(page, "08-verdict-receipt");

  await browser.close();
  console.log("\nDone. Files in docs/screenshots/.");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
