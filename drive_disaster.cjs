const { chromium } = require("playwright");

const OUT = "C:\\Users\\ACER\\AppData\\Local\\Temp\\claude\\l--Husni-Penelitian-Hiliriset-Eksperimen-Platform-Rancangan-UI-geomoka-savegeo\\0ff3ef7a-2227-4bc1-97ca-764506cad21f\\scratchpad";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

  await page.goto("http://localhost:5501/pemetaan-bencana", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01_login_gate.png` });

  // switch to register view
  const registerLink = page.getByText(/daftar|register/i).first();
  if (await registerLink.count()) {
    await registerLink.click();
  }
  await page.screenshot({ path: `${OUT}/02_register_form.png` });

  const uname = "drivetest_" + Date.now();
  await page.fill('input[name="username"], input[type="text"]', uname);
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  if (await emailInput.count()) await emailInput.fill(`${uname}@example.com`);
  const pwFields = page.locator('input[type="password"]');
  const pwCount = await pwFields.count();
  for (let i = 0; i < pwCount; i++) {
    await pwFields.nth(i).fill("DriveTest12345");
  }
  await page.screenshot({ path: `${OUT}/03_register_filled.png` });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/04_after_register.png` });

  await page.waitForURL("**/pemetaan-bencana**", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/05_disaster_list.png` });

  const bodyText = await page.textContent("body");
  console.log("PAGE_CONTAINS_BANJIR:", bodyText.includes("Banjir Sumatera"));

  // click first "Banjir Sumatera 2025" card/link
  const eventLink = page.getByText(/Banjir Sumatera 2025/).first();
  if (await eventLink.count()) {
    await eventLink.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/06_event_detail.png` });
  } else {
    console.log("NO_EVENT_LINK_FOUND");
  }

  console.log("CONSOLE_ERRORS:", JSON.stringify(consoleErrors, null, 2));
  await browser.close();
})();
