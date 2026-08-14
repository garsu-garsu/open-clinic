/**
 * 시군구 중심좌표 표 만들기 (배치 — 행정구역은 거의 안 바뀌니 한 번만 돌려요)
 *
 *   EGEN_KEY=발급키 node scripts/build-districts.mjs
 *
 * 공공데이터 API 는 좌표가 아니라 "시도/시군구 이름"으로만 검색이 돼요.
 * 앱은 좌표만 알기 때문에, 가장 가까운 시군구를 고를 수 있게 이 표가 필요합니다.
 * 병의원 API 를 시도별로 훑어 각 기관 주소(dutyAddr)에서 시군구 이름을 뽑고
 * 좌표 평균을 내서 시군구 중심점을 계산해요.
 *
 * ⚠️ Q1(시군구) 파라미터는 "수원시 장안구"처럼 합쳐 쓰면 0건이 나와요.
 *    실제로 먹는 건 "장안구"처럼 가장 작은 단위 하나뿐이에요(실측 확인).
 *    그래서 주소에서 시/군/구로 끝나는 마지막 한 토큰만 뽑습니다.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "./tiny-xml.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/lib/districts.ts");
const ENDPOINT =
  "http://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire";

// 세종은 시군구가 따로 없어서(광역시/도 자체가 한 덩어리) 목록엔 있지만
// 조회 땐 Q1 없이 Q0만 씁니다.
//
// ⚠️ 광주만 예외예요. 병의원 API 데이터의 대부분은 주소가 "전남광주통합특별시"로
//    박혀 있고 "광주광역시"로 시작하는 주소는 7건뿐이에요(실측). 반면 약국 API는
//    "광주광역시"를 정상적으로 씁니다. 그래서 이 표는 "전남광주통합특별시"로 만들고,
//    약국을 조회할 때만 "광주광역시"로 바꿔치기해요 → src/lib/places.ts 의
//    PHARMACY_SIDO_OVERRIDE 를 보세요.
const SIDO = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "전남광주통합특별시",
  "대전광역시", "울산광역시", "세종특별자치시", "경기도", "강원특별자치도",
  "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도",
  "경상남도", "제주특별자치도",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPage(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      return XMLParser(await res.text());
    } catch (e) {
      if (i === 2) throw e;
      await sleep(500 * (i + 1));
    }
  }
}

/**
 * 주소에서 시도 접두어를 떼고 남은 부분의 첫 토큰(들)로 시군구를 고릅니다.
 * "수원시 장안구 ..." → "장안구" (구가 있으면 구까지가 진짜 단위)
 * "강남구 ..."        → "강남구" (이미 구 단독)
 * "홍천군 ..."        → "홍천군"
 * "화성시 ..."        → "화성시" (구가 없는 시는 시 자체가 단위)
 * "새롬중앙로 55 ..."  → null (세종처럼 시군구가 없는 주소)
 */
export function pickDistrict(sido, addr) {
  const rest = addr.startsWith(sido) ? addr.slice(sido.length).trim() : addr.trim();
  const [t1, t2] = rest.split(/\s+/);
  if (t1 == null) return null;
  if (t1.endsWith("시") && t2 != null && t2.endsWith("구")) return t2;
  if (t1.endsWith("시") || t1.endsWith("군") || t1.endsWith("구")) return t1;
  return null;
}

async function collectSido(key, sido, sums) {
  let page = 1;
  let seen = 0;
  let total = Infinity;

  while (seen < total) {
    const url = `${ENDPOINT}?serviceKey=${key}&Q0=${encodeURIComponent(sido)}&pageNo=${page}&numOfRows=1000`;
    const body = await getPage(url);
    const items = body.items ?? [];
    total = Number(body.totalCount ?? items.length);

    for (const it of items) {
      const lat = Number(it.wgs84Lat);
      const lng = Number(it.wgs84Lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      // 시군구 토큰이 없는 주소는 세종만 예외(원래 시군구가 없음). 나머지는
      // "시도 시도" 오염 행이 되니 버려요. 방어로 시/군/구로 안 끝나면도 버립니다.
      const gu = pickDistrict(sido, String(it.dutyAddr ?? "")) ?? (sido === "세종특별자치시" ? sido : null);
      if (gu == null || !/[시군구]$/.test(gu)) continue;
      const k = `${sido}|${gu}`;
      const s = sums.get(k) ?? { lat: 0, lng: 0, n: 0 };
      s.lat += lat;
      s.lng += lng;
      s.n += 1;
      sums.set(k, s);
    }

    seen += items.length;
    if (items.length === 0) break;
    console.log(`  ${sido} ${seen}/${total}`);
    page++;
    await sleep(120);
  }
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

async function main() {
  const key = process.env.EGEN_KEY;
  if (key == null) {
    console.error("EGEN_KEY 가 필요해요.");
    process.exit(1);
  }

  const sums = new Map();
  for (const sido of SIDO) await collectSido(key, sido, sums);

  const rows = [...sums.entries()]
    .map(([k, s]) => {
      const [sido, gu] = k.split("|");
      return [sido, gu, round6(s.lat / s.n), round6(s.lng / s.n)];
    })
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

  const body = rows
    .map(([sido, gu, lat, lng]) => `  ["${sido}", "${gu}", ${lat}, ${lng}],`)
    .join("\n");

  writeFileSync(
    OUT,
    `/**\n * 시군구 중심좌표 표. scripts/build-districts.mjs 로 한 번 구운 값이에요.\n` +
      ` * 공공데이터 API 가 좌표 검색을 안 줘서, 내 위치에서 가장 가까운 시군구를\n` +
      ` * 골라 그 이름으로 병의원·약국을 조회합니다.\n` +
      ` *\n` +
      ` * [시도, 시군구, 위도, 경도]. 시군구가 없는 세종은 시도명을 그대로 넣었어요\n` +
      ` * — 조회할 때 시군구 없이 시도만으로 검색하면 돼요.\n */\n` +
      `export const DISTRICTS: [string, string, number, number][] = [\n${body}\n];\n`,
  );

  console.log(`\n시군구 ${rows.length}개 저장 → ${OUT}`);
}

/* 자체 점검 — `node scripts/build-districts.mjs --check` */
export function demo() {
  const eq = (got, want, label) => {
    if (got !== want) throw new Error(`${label}: ${String(got)} !== ${String(want)}`);
  };
  eq(pickDistrict("경기도", "경기도 수원시 장안구 경수대로 857 (조원동)"), "장안구", "3단계는 구만");
  eq(pickDistrict("서울특별시", "서울특별시 강남구 테헤란로 1"), "강남구", "이미 구 단독");
  eq(pickDistrict("강원특별자치도", "강원특별자치도 홍천군 남면 양덕원로 55"), "홍천군", "군 단위");
  eq(pickDistrict("경기도", "경기도 화성시 동탄대로 1"), "화성시", "구 없는 시는 시 자체");
  eq(pickDistrict("세종특별자치시", "세종특별자치시 새롬중앙로 55"), null, "세종은 시군구 없음");
  console.log("build-districts pickDistrict OK");
}

if (process.argv[2] === "--check") demo();
else main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
