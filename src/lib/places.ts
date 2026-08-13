import { distanceM, nearbyCells, type LatLng } from "./geo";
import { openState, type OpenState, type Week } from "./schedule";

/** 0 = 병·의원, 1 = 약국 */
export type Kind = 0 | 1;

/**
 * 격자 파일 한 줄. 전국 10만 곳을 담아야 해서 객체 대신 배열로 눌러 놨어요.
 * [위도, 경도, 이름, 전화, 종류, 진료과목, 시간표8칸]
 */
export type Row = [number, number, string, string, Kind, string, Week];

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

const CELL_URL = (key: string) => `/data/cells/${key}.json`;

const cache = new Map<string, Row[]>();

async function loadCell(key: string): Promise<Row[]> {
  const hit = cache.get(key);
  if (hit != null) return hit;
  try {
    const res = await fetch(CELL_URL(key));
    // 기관이 하나도 없는 칸은 파일 자체가 없어요. 404 는 정상이에요.
    const rows = res.ok ? ((await res.json()) as Row[]) : [];
    cache.set(key, rows);
    return rows;
  } catch {
    cache.set(key, []);
    return [];
  }
}

export const RADIUS_OPTIONS = [1000, 3000, 10000] as const;
export type Radius = (typeof RADIUS_OPTIONS)[number];

/** 내 주변 전부를 가까운 순으로. 반경·종류 필터는 화면에서 겁니다. */
export async function findNearby(me: LatLng, holiday = false): Promise<Place[]> {
  const cells = await Promise.all(nearbyCells(me.lat, me.lng).map(loadCell));

  return cells
    .flat()
    .map(([lat, lng, name, tel, kind, dept, week]) => ({
      lat,
      lng,
      name,
      tel,
      kind,
      dept,
      week,
      distance: distanceM(me, { lat, lng }),
      state: openState(week, undefined, holiday),
    }))
    .sort((a, b) => a.distance - b.distance);
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
