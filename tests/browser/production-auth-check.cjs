// Authenticated production smoke check. Credentials are read only from env.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

const base = process.env.SAVEGEO_PRODUCTION_URL;
const username = process.env.SAVEGEO_TEST_USERNAME;
const password = process.env.SAVEGEO_TEST_PASSWORD;
if (!base || !username || !password) {
  console.error("NOT RUN: set SAVEGEO_PRODUCTION_URL, SAVEGEO_TEST_USERNAME and SAVEGEO_TEST_PASSWORD");
  process.exitCode = 2;
} else {
  (async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${base.replace(/\/$/, "")}/login`, { waitUntil: "networkidle" });
      await page.locator("#unified-username").fill(username);
      await page.locator("#unified-password").fill(password);
      await page.locator("button[type=submit]").click();
      await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
      await page.goto(`${base.replace(/\/$/, "")}/pemetaan-bencana`, { waitUntil: "networkidle" });
      assert(!page.url().endsWith("/login"), "authenticated user was redirected back to login");
      const text = await page.locator("body").innerText();
      assert.match(text, /Dashboard Intelijen Bencana|Tidak dapat memuat daftar bencana|Terjadi kesalahan jaringan/);
      assert.deepEqual(errors, [], "production page raised a JavaScript error");
      console.log("PASS authenticated production page: login, protected route and disaster dashboard shell");
    } finally {
      await browser.close();
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
