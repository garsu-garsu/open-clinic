import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const PAGE_URL = "http://localhost:5183/";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 636, height: 1048 });
await browser.defaultBrowserContext().overridePermissions(new URL(PAGE_URL).origin, ["geolocation"]);
await page.setGeolocation({ latitude: 37.4979, longitude: 127.0276 });
await page.goto(PAGE_URL, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 4000));

// 지도 탭으로 전환
const navButtons = await page.$$("nav button");
await navButtons[1].click();
await new Promise((r) => setTimeout(r, 1000));

const radiusChips = await page.$$("div button");
async function clickChipWithText(text) {
  for (const b of radiusChips) {
    const t = await page.evaluate((el) => el.textContent, b);
    if (t === text) {
      await b.click();
      return true;
    }
  }
  return false;
}

await clickChipWithText("1km");
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: "screenshots/map-1km.png" });

await clickChipWithText("3km");
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: "screenshots/map-3km.png" });

await clickChipWithText("10km");
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: "screenshots/map-10km.png" });

// 약국 탭
const freshButtons = await page.$$("div button");
for (const b of freshButtons) {
  const t = await page.evaluate((el) => el.textContent, b);
  if (t === "약국") {
    await b.click();
    break;
  }
}
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: "screenshots/map-pharmacy.png" });

console.log("done");
await browser.close();
