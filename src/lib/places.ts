import { DISTRICTS } from "./districts";
import { DATA_KEY } from "./env";
import { distanceM, type LatLng } from "./geo";
import { openState, slotOf, type OpenState, type Week } from "./schedule";
import { parseXml } from "./xml";

/** 0 = 병·의원, 1 = 약국 */
export type Kind = 0 | 1;

/** API 응답 한 건을 눌러 담은 배열. localStorage 에 이 형태로 캐싱해요. */
type Row = [number, number, string, string, Kind, string, Week];

export interface Place {
  lat: number;
  lng: number;
  name: string;
  tel: string;
  kind: Kind;
  dept: string;
  week: Week;
  distance: number;
  state: OpenState;
}

const ENDPOINT: Record<Kind, string> = {
  0: "https://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire",
  1: "https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire",
};

// 병의원 API 데이터는 광주·전남을 "전남광주통합특별시" 하나로 묶어서 줘요(실측 확인).
// 약국 API 는 그 이름을 몰라서 0건에 가깝게 나오고, 원래 이름(광주광역시/전라남도)을
// 써야 정상 조회돼요. districts.ts 는 병의원 기준으로 만들어졌으니 약국을 부를 때만
// 되돌립니다.
const GWANGJU_GU = new Set(["동구", "서구", "남구", "북구", "광산구"]);
function sidoFor(kind: Kind, sido: string, gu: string): string {
  if (kind === 1 && sido === "전남광주통합특별시") {
    return GWANGJU_GU.has(gu) ? "광주광역시" : "전라남도";
  }
  return sido;
}

/**
 * 내 위치 반경 안에 걸치는 시군구들. 좌표 반경 검색이 없어서 이름으로 찾아야 하는데,
 * 경계에 서 있으면 가장 가까운 시군구 하나만 봐서는 바로 옆 구가 통째로 빠져요
 * (강남역 → 서초구만 잡히고 강남구가 안 잡히는 식).
 *
 * ponytail: 시군구 중심점까지 거리가 `반경 + 5km` 안이면 후보, 가까운 순으로 최대 3개.
 *           평일 한 구가 2.8MB 라 무작정 다 받으면 안 돼서 잘랐어요. 더 넓혀야 하면
 *           이 3 을 올리세요(캐시가 구 단위라 늘려도 구조는 그대로 씁니다).
 */
function nearestDistricts(me: LatLng, radiusM: number, max = 3): { sido: string; gu: string }[] {
  const sorted = DISTRICTS.map(([sido, gu, lat, lng]) => ({
    sido,
    gu,
    dist: distanceM(me, { lat, lng }),
  })).sort((a, b) => a.dist - b.dist);
  const within = sorted.filter((d) => d.dist <= radiusM + 5000);
  // 반경 안에 걸리는 시군구가 하나도 없는 외딴 곳이면 그래도 가장 가까운 곳 하나는 보여줘요.
  return (within.length > 0 ? within : sorted.slice(0, 1)).slice(0, max);
}

/**
 * dutyTime1s/1c ~ dutyTime8s/8c → 8칸 시간표.
 * s = 시작(HHMM), c = 종료(HHMM). 한쪽만 있으면 못 믿으니 버립니다.
 */
function toWeek(item: Record<string, string>): Week {
  // 타입은 string[] 이지만 schedule.ts 는 undefined 도 "정보 없음"으로 읽어요.
  const out: (string | undefined)[] = [];
  for (let i = 1; i <= 8; i++) {
    const s = (item[`dutyTime${i}s`] ?? "").trim();
    const c = (item[`dutyTime${i}c`] ?? "").trim();
    if (!/^\d{4}$/.test(s) || !/^\d{4}$/.test(c)) {
      // 값이 아예 없는 요일은 "휴무"가 아니라 "정보 없음"이에요.
      out.push(s === "" && c === "" ? "" : undefined);
      continue;
    }
    out.push(`${s}-${c}`);
  }
  return out as Week;
}

/** 오늘 요일 → QT 값. 1=월 … 6=토, 7=일, 8=공휴일(실측 확인된 필터). */
function todayQT(holiday: boolean): number {
  return holiday ? 8 : slotOf(new Date().getDay()) + 1;
}

/** KST(UTC+9) 기준 "오늘" 키. 자정이 지나면 캐시가 자연히 새로 받아져요. */
function kstDateKey(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

const CACHE_PREFIX = "open-clinic:places:";

function cacheKey(kind: Kind, sido: string, gu: string, qt: number): string {
  return `${CACHE_PREFIX}${kind}:${sido}:${gu}:${qt}:${kstDateKey()}`;
}

function readCache(key: string): Row[] | null {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as Row[]) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, rows: Row[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // 용량 초과 등은 조용히 무시해요 — 캐시가 안 되도 앱은 계속 동작해야 해요.
  }
}

function isKoreaCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat > 33 && lat < 39 && lng > 124 && lng < 132;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** 한 시군구·한 종류를 API 에서 전부 받아와 Row 로 눌러요. 페이지네이션은 여기서 처리. */
async function fetchRows(kind: Kind, sido: string, gu: string, qt: number): Promise<Row[]> {
  const q0 = sidoFor(kind, sido, gu);
  const base = ENDPOINT[kind];
  const perPage = 1000;
  const rows: Row[] = [];
  let page = 1;
  let total = Infinity;

  while (rows.length < total) {
    const url =
      `${base}?serviceKey=${DATA_KEY}&Q0=${encodeURIComponent(q0)}` +
      // 시군구가 시도와 같으면(세종처럼 하위 구역이 없는 곳) Q1 을 빼요.
      (gu !== q0 ? `&Q1=${encodeURIComponent(gu)}` : "") +
      `&QT=${qt}&pageNo=${page}&numOfRows=${perPage}`;
    const res = await fetch(url);
    const { items, totalCount } = parseXml(await res.text());
    total = totalCount;

    for (const it of items) {
      const lat = Number(it.wgs84Lat);
      const lng = Number(it.wgs84Lon);
      if (!isKoreaCoord(lat, lng)) continue;
      const name = (it.dutyName ?? "").trim();
      if (name === "") continue;
      rows.push([
        round6(lat),
        round6(lng),
        name,
        (it.dutyTel1 ?? "").trim(),
        kind,
        (it.dutyDivNam ?? "").trim(),
        toWeek(it),
      ]);
    }

    if (items.length === 0) break;
    page++;
  }

  return rows;
}

async function loadRows(kind: Kind, sido: string, gu: string, qt: number): Promise<Row[]> {
  const key = cacheKey(kind, sido, gu, qt);
  const cached = readCache(key);
  if (cached != null) return cached;

  const rows = await fetchRows(kind, sido, gu, qt);
  writeCache(key, rows);
  return rows;
}

export const RADIUS_OPTIONS = [1000, 3000, 10000] as const;
export type Radius = (typeof RADIUS_OPTIONS)[number];

function toPlaces(me: LatLng, holiday: boolean, rows: Row[]): Place[] {
  return rows.map(([lat, lng, name, tel, kind, dept, week]) => ({
    lat,
    lng,
    name,
    tel,
    kind,
    dept,
    week,
    distance: distanceM(me, { lat, lng }),
    state: openState(week, undefined, holiday),
  }));
}

/**
 * 내 위치 반경 안 시군구들의 병·의원 + 약국을 오늘 진료 기준으로 불러와요.
 * 반경·종류 필터는 화면에서 겁니다(여기서는 시군구를 고르는 데만 반경을 써요).
 *
 * 가장 가까운 시군구부터 순서대로 받고, 하나 끝날 때마다 `onUpdate` 로 그때까지
 * 모은 목록을 넘겨요 — 첫 화면이 뜰 때까지 다른 구까지 기다리게 하면 안 돼요.
 */
export async function findNearby(
  me: LatLng,
  holiday = false,
  onUpdate?: (list: Place[]) => void,
): Promise<Place[]> {
  const maxRadius = RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1];
  const districts = nearestDistricts(me, maxRadius);
  const qt = todayQT(holiday);

  let all: Place[] = [];
  for (const { sido, gu } of districts) {
    const [clinics, pharmacies] = await Promise.all([
      loadRows(0, sido, gu, qt),
      loadRows(1, sido, gu, qt),
    ]);
    all = all
      .concat(toPlaces(me, holiday, clinics), toPlaces(me, holiday, pharmacies))
      .sort((a, b) => a.distance - b.distance);
    onUpdate?.(all);
  }
  return all;
}

/**
 * 반경·종류로 거르고, 지금 문 연 곳을 위로.
 * 이 앱을 여는 사람은 "지금 갈 수 있는 곳"을 찾는 거예요. 닫힌 곳을
 * 거리만 보고 맨 위에 올리면 앱을 여는 이유가 사라집니다.
 */
export function filterPlaces(
  list: Place[],
  kind: Kind,
  radius: number,
  onlyOpen: boolean,
): Place[] {
  const rank = (p: Place) => (p.state === "open" ? 0 : p.state === "unknown" ? 1 : 2);
  return list
    .filter((p) => p.kind === kind && p.distance <= radius)
    .filter((p) => !onlyOpen || p.state !== "closed")
    .sort((a, b) => rank(a) - rank(b) || a.distance - b.distance);
}

/** 카카오맵 길찾기. 앱이 깔려 있으면 앱으로, 아니면 웹으로 열려요. */
export function directionsUrl(p: Place): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lng}`;
}

export function telUrl(p: Place): string {
  return `tel:${p.tel.replace(/[^0-9+]/g, "")}`;
}
