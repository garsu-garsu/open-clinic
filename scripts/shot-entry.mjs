/**
 * 진입 직후 화면을 시간대별로 찍어요. 반려 사유가 "접속 직후 바텀시트" 라
 * 무엇이 언제 뜨는지 눈으로 봐야 합니다.
 *   npx vite dev --port 5195 --strictPort  (다른 창에서)
 *   node scripts/shot-entry.mjs [deny]
 */
import puppeteer from "puppeteer-core";

const CHROME = String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`;
const URL_ = process.env.BASE_URL ?? "http://localhost:5195/";
const deny = process.argv.includes("deny");

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 636, height: 1048, deviceScaleFactor: 1 });
if (!deny) {
  await browser.defaultBrowserContext().overridePermissions(new URL(URL_).origin, ["geolocation"]);
  await page.setGeolocation({ latitude: 37.5665, longitude: 126.978 });
}
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 30000 });
for (const ms of [600, 1500, 3000, 5000]) {
  await new Promise((r) => setTimeout(r, ms === 600 ? 600 : 900));
  const tag = `${deny ? "deny-" : ""}entry-${ms}`;
  await page.screenshot({ path: `screenshots/${tag}.png` });
  const info = await page.evaluate(() => {
    // 화면 아래쪽에 붙어 있는 큰 덩어리를 찾아요 — 바텀시트로 보이는 것들.
    const out = [];
    for (const el of document.querySelectorAll("div")) {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      const bottomAnchored = r.height > 80 && r.width > 250 && r.bottom > window.innerHeight - 140;
      if (bottomAnchored && st.position !== "static" && r.top > 200) {
        out.push(`${Math.round(r.top)}~${Math.round(r.bottom)} h=${Math.round(r.height)} bg=${st.backgroundColor} z=${st.zIndex}`);
      }
    }
    return out.slice(0, 6);
  });
  console.log(`[${tag}] 하단 고정 덩어리:`, info.length ? info : "없음");
}
console.log("페이지 오류:", errors.length === 0 ? "없음" : errors.slice(0, 3));
await browser.close();
