/** 격자 한 칸의 크기(도). 한 변이 위도로 약 5.5km, 경도로 약 4.5km 예요. */
export const CELL = 0.05;

export interface LatLng {
  lat: number;
  lng: number;
}

/** 좌표가 속한 격자 칸 이름. 데이터 파일 이름과 1:1로 같아요. */
export function cellKey(lat: number, lng: number): string {
  return `${Math.floor(lat / CELL)}_${Math.floor(lng / CELL)}`;
}

/**
 * 내 위치를 둘러싼 3x3 칸.
 * 내가 칸 가장자리에 서 있으면 바로 옆 칸에 있는 화장실이 더 가까울 수 있어서
 * 내 칸만 읽으면 안 돼요.
 */
export function nearbyCells(lat: number, lng: number): string[] {
  const y = Math.floor(lat / CELL);
  const x = Math.floor(lng / CELL);
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) keys.push(`${y + dy}_${x + dx}`);
  }
  return keys;
}

const R = 6371000; // 지구 반지름(m)

/** 두 점 사이 직선거리(m). 걷는 거리가 아니라 직선이라 실제론 이보다 멀어요. */
export function distanceM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "230m" / "1.2km" — 급할 때 읽는 화면이라 소수점은 한 자리까지만. */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

/** 성인 도보 분. 시속 4km 기준이고, 신호·계단은 못 봐요. */
export function walkMinutes(m: number): number {
  return Math.max(1, Math.round(m / 66));
}
