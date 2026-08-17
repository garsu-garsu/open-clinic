/**
 * 지도 앱 선택창이 제대로 뜨고, 고른 뒤 되돌리는 줄이 생기는지 확인.
 *
 *   npx vite preview --port 4173 --strictPort   (다른 창에서)
 *   node scripts/shot-mapapp.mjs
 */
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const URL_ = process.env.BASE_URL ?? "http://localhost:5191/";
const OUT = "screenshots";

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 636, height: 1048, deviceScaleFactor: 1 });
await browser.defaultBrowserContext().overridePermissions(new URL(URL_).origin, ["geolocation"]);
await page.setGeolocation({ latitude: 37.5665, longitude: 126.978 });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL_, { waitUntil: "networkidle2", timeout: 30000 });
await page.evaluate(() => localStorage.setItem("open-clinic:coach:v1", "1"));
await page.reload({ waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 3500));

/** 목록 탭으로 옮겨요 — 여기 길찾기 버튼이 줄마다 있어요. */
const tabs = await page.$$("nav button");
if (tabs.length >= 2) await tabs[1].click();
await new Promise((r) => setTimeout(r, 900));

const clickText = (label) =>
  page.evaluate((t) => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === t);
    if (btn == null) return false;
    btn.click();
    return true;
  }, label);

console.log("길찾기 클릭:", await clickText("길찾기"));
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `${OUT}/mapapp-1-picker.png` });
console.log(
  "선택창 문구:",
  await page.evaluate(() => document.body.innerText.match(/어느 지도[^\n]*/)?.[0] ?? "없음"),
);

// "다음에도 이 지도로" 를 켜고 네이버지도를 고르면 기억해야 해요.
await page.evaluate(() => {
  const box = document.querySelector('input[type="checkbox"]');
  if (box != null) box.click();
});
console.log("네이버지도 클릭:", await clickText("네이버지도"));
await new Promise((r) => setTimeout(r, 1200));

console.log(
  "저장된 지도 앱:",
  await page.evaluate(() => localStorage.getItem("open-clinic:map-app:v1")),
);

// 목록 하단으로 내려가 되돌리는 줄을 확인해요.
await page.evaluate(() => {
  const pane = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 50);
  if (pane != null) pane.scrollTop = pane.scrollHeight;
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `${OUT}/mapapp-2-reset.png` });
console.log(
  "되돌리는 줄:",
  await page.evaluate(() => document.body.innerText.match(/길찾기는[^\n]*/)?.[0] ?? "없음"),
);
console.log("페이지 오류:", errors.length === 0 ? "없음" : errors.slice(0, 3));

await browser.close();
