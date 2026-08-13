/**
 * 병·의원 + 약국 원장 굽기 (배치 — 데이터가 바뀔 때만 다시 돌려요)
 *
 *   EGEN_KEY=발급키 node scripts/build-places.mjs
 *   EGEN_KEY=발급키 node scripts/build-places.mjs --probe   ← 먼저 이걸로 응답 확인
 *
 * 출처 (둘 다 공공데이터포털, 무료)
 *   전국 병·의원 찾기 서비스   https://www.data.go.kr/data/15000736/openapi.do
 *   약국 정보 조회 서비스      https://www.data.go.kr/data/15000576/openapi.do
 *
 * 진료시간표는 이 API에 이미 들어 있어요(dutyTime1s ~ dutyTime8c).
 * 좌표도 wgs84Lat/wgs84Lon 으로 같이 옵니다 — 지오코딩이 필요 없어요.
 *
 * 결과는 0.05도 격자로 쪼개 public/data/cells/{y}_{x}.json 에 저장합니다.
 * 앱은 내 주변 3x3 칸만 읽어요.
 *
 * ⚠️ 응답 필드명이 --probe 출력과 다르면 아래 FIELD 만 고치세요.
 */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "./tiny-xml.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../public/data/cells");
const CELL = 0.05;

const ENDPOINT = {
  clinic:
    "http://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire",
  pharmacy:
    "http://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire",
};

const FIELD = {
  name: "dutyName",
  tel: "dutyTel1",
  lat: "wgs84Lat",
  lng: "wgs84Lon",
  dept: "dutyDivNam",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPage(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      const xml = await res.text();
      return XMLParser(xml);
    } catch (e) {
      if (i === 2) throw e;
      await sleep(500 * (i + 1));
    }
  }
}

/**
 * dutyTime1s/1c ~ dutyTime8s/8c → 8칸 시간표.
 * s = 시작(HHMM), c = 종료(HHMM). 한쪽만 있으면 못 믿으니 버립니다.
 */
export function toWeek(item) {
  const out = [];
  for (let i = 1; i <= 8; i++) {
    const s = String(item[`dutyTime${i}s`] ?? "").trim();
    const c = String(item[`dutyTime${i}c`] ?? "").trim();
    if (!/^\d{4}$/.test(s) || !/^\d{4}$/.test(c)) {
      // 값이 아예 없는 요일은 "휴무"가 아니라 "정보 없음"이에요.
      out.push(s === "" && c === "" ? "" : undefined);
      continue;
    }
    out.push(`${s}-${c}`);
  }
  return out;
}

async function collect(kind, key, cells) {
  const base = kind === 0 ? ENDPOINT.clinic : ENDPOINT.pharmacy;
  const perPage = 1000;
  let page = 1;
  let seen = 0;
  let total = Infinity;

  while (seen < total) {
    const url =
      `${base}?serviceKey=${key}&pageNo=${page}&numOfRows=${perPage}`;
    const body = await getPage(url);
    const items = body.items ?? [];
    total = Number(body.totalCount ?? items.length);

    for (const it of items) {
      const lat = Number(it[FIELD.lat]);
      const lng = Number(it[FIELD.lng]);
      if (!isKoreaCoord(lat, lng)) continue;
      const name = String(it[FIELD.name] ?? "").trim();
      if (name === "") continue;

      const k = `${Math.floor(lat / CELL)}_${Math.floor(lng / CELL)}`;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push([
        round6(lat),
        round6(lng),
        name,
        String(it[FIELD.tel] ?? "").trim(),
        kind,
        String(it[FIELD.dept] ?? "").trim(),
        toWeek(it),
      ]);
    }

    seen += items.length;
    if (items.length === 0) break;
    console.log(`  ${kind === 0 ? "병의원" : "약국"} ${seen}/${total}`);
    page++;
    await sleep(120);
  }
}

function isKoreaCoord(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat > 33 && lat < 39 && lng > 124 && lng < 132
  );
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

async function main() {
  const key = process.env.EGEN_KEY;
  if (key == null) {
    console.error("EGEN_KEY 가 필요해요. 공공데이터포털에서 두 API 활용신청 후 인코딩 키를 넣으세요.");
    process.exit(1);
  }

  if (process.argv[2] === "--probe") {
    const body = await getPage(
      `${ENDPOINT.clinic}?serviceKey=${key}&pageNo=1&numOfRows=2`,
    );
    console.log("총건수:", body.totalCount);
    console.log(JSON.stringify(body.items?.[0], null, 2));
    console.log("\n시간표로 줄이면:", toWeek(body.items?.[0] ?? {}));
    return;
  }

  const cells = new Map();
  await collect(0, key, cells);
  await collect(1, key, cells);

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  let total = 0;
  for (const [k, list] of cells) {
    writeFileSync(`${OUT}/${k}.json`, JSON.stringify(list));
    total += list.length;
  }
  console.log(`\n기관 ${total}곳 / 격자 ${cells.size}칸 저장`);
}

/* 자체 점검 — 시간표 변환이 이 스크립트의 유일한 진짜 로직이에요. */
export function demo() {
  const j = (v) => JSON.stringify(v);
  const eq = (got, want, label) => {
    if (j(got) !== j(want)) throw new Error(`${label}: ${j(got)} !== ${j(want)}`);
  };

  eq(
    toWeek({
      dutyTime1s: "0900", dutyTime1c: "1800",
      dutyTime6s: "0900", dutyTime6c: "1300",
    }),
    ["0900-1800", "", "", "", "", "0900-1300", "", ""],
    "빈 요일은 휴무",
  );
  eq(
    toWeek({ dutyTime1s: "0900" })[0],
    undefined,
    "시작만 있고 종료가 없으면 못 믿으니 정보없음",
  );
  eq(toWeek({})[3], "", "아예 비면 휴무");
  console.log("build-places toWeek OK");
}

if (process.argv[2] === "--check") demo();
else main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
