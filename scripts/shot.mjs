/**
 * 화면 확인용 스크린샷(636x1048 — 콘솔 제출 규격).
 *
 *   npx vite dev --port 5173   (다른 창에서 띄워두고)
 *   node scripts/shot.mjs
 *
 * ⚠️ 반드시 `vite dev`(개발 서버)로 확인하세요. `vite build`/`vite preview`는
 *    NODE_ENV=production 이라 @apps-in-toss/devtools 의 위치 모킹이 빠지고,
 *    Device.getLocation 이 진짜 토스 앱 브릿지를 찾다가 그냥 던져버려요 — 그래서
 *    데이터가 있는지 없는지와 무관하게 "위치를 확인하지 못했어요" 화면만 보여요.
 *    개발 서버에서는 표준 geolocation 으로 좌표를 흘려보내는 모킹이 살아 있어서
 *    강남역 좌표를 물리면 실제 공공데이터 API 를 호출해 병원·약국 이름까지 확인할 수 있어요.
 *    (프로덕션 빌드 자체가 되는지는 `npm run build` 로 따로 확인하세요.)
 */
import { mkdir } from "node:fs/promises";

import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const PAGE_URL = process.env.BASE_URL ?? "http://localhost:5173/";
const OUT = "screenshots";
const SIZE = { width: 636, height: 1048, deviceScaleFactor: 1 };

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
  const apiFailed = [];
  page.on("response", (r) => {
    if (r.url().includes("apis.data.go.kr") && r.status() >= 400) {
      apiFailed.push(`${r.status()} ${r.url()}`);
    }
  });

  // 강남역(37.4979, 127.0276). 강남구/서초구 경계라 여러 시군구 조회가 되는지도
  // 같이 확인돼요. 다른 좌표로 확인하려면 이 두 값만 바꾸세요.
  const ME = { latitude: 37.4979, longitude: 127.0276 };
  await browser.defaultBrowserContext().overridePermissions(new URL(PAGE_URL).origin, [
    "geolocation",
  ]);
  await page.setGeolocation(ME);

  await page.goto(PAGE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  // 위치 확인 → API 페이지네이션까지 걸리니 넉넉히 기다려요.
  await new Promise((r) => setTimeout(r, 4000));

  // 기본 탭이 목록이에요 — 실제 기관 이름이 찍히는지는 여기서 봐야 해요.
  await page.screenshot({ path: `${OUT}/1-list.png` });

  const tabs = await page.$$("nav button");
  if (tabs.length >= 2) {
    await tabs[1].click();
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: `${OUT}/2-map.png` });
  }

  const names = await page.$$eval("div", (els) =>
    els
      .map((e) => e.textContent ?? "")
      .filter((t) => /(의원|병원|약국|치과|한의원)/.test(t) && t.length < 20),
  );

  console.log(`스크린샷 ${OUT}/ 에 저장`);
  console.log("API 호출 실패:", apiFailed.length === 0 ? "없음" : apiFailed.slice(0, 5));
  console.log("페이지 오류:", errors.length === 0 ? "없음" : errors.slice(0, 3));
  console.log("목록에서 찾은 기관 이름 예시:", [...new Set(names)].slice(0, 8));
} finally {
  await browser.close();
}
