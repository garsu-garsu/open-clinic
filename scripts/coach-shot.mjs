/**
 * 코치마크 온보딩 + 지도 마커 확인용 스크린샷. shot.mjs 와 같은 방식(강남역 좌표
 * 모킹, puppeteer-core + 시스템 Chrome)으로 위치·목록이 준비된 뒤 코치마크가 뜨는지,
 * 건너뛰면 다시 안 뜨는지, 마커 모양이 내 위치/핀으로 구분되는지 확인해요.
 *
 *   npx vite dev --port 5174   (다른 창에서 띄워두고)
 *   node scripts/coach-shot.mjs
 */
import { mkdir } from "node:fs/promises";

import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const PAGE_URL = process.env.BASE_URL ?? "http://localhost:5174/";
const OUT = "screenshots";
const SIZE = { width: 636, height: 1048, deviceScaleFactor: 1 };
const ME = { latitude: 37.4979, longitude: 127.0276 }; // 강남역

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [`--window-size=${SIZE.width},${SIZE.height}`],
});

try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport(SIZE);

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await browser.defaultBrowserContext().overridePermissions(new URL(PAGE_URL).origin, ["geolocation"]);
  await page.setGeolocation(ME);

  await page.goto(PAGE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  // 위치 확인 → API 페이지네이션까지 걸리니 넉넉히 기다려요.
  await new Promise((r) => setTimeout(r, 4000));

  await page.screenshot({ path: `${OUT}/readme-coach-1.png` });
  await page.click('[aria-label="다음"]');
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/readme-coach-2.png` });

  const buttons = await page.$$("button");
  for (const b of buttons) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text === "건너뛰기") {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/readme-coach-done.png` });

  // 기본 탭이 지도라 여기서 바로 마커 모양(내 위치 후광+점 vs 병원 핀)을 확인해요.
  await page.screenshot({ path: `${OUT}/readme-marker.png` });

  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));
  const stillThere = await page.$('[aria-label="다음"]');

  console.log(`스크린샷 ${OUT}/ 에 저장`);
  console.log("새로고침 후 코치마크 재등장:", stillThere != null ? "예(문제)" : "아니오(정상)");
  console.log("페이지 오류:", errors.length === 0 ? "없음" : errors);
} finally {
  await browser.close();
}
