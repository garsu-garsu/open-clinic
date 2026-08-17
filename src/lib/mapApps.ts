/**
 * 길찾기를 어느 지도 앱으로 열지.
 *
 * 안드로이드의 "앱 선택 → 한 번만 / 항상" 창은 OS 가 인텐트로 띄우는 것이라
 * 웹뷰 미니앱에서는 만들 수 없어요(그 "항상" 설정도 OS 가 들고 있어서 앱에서
 * 초기화할 방법이 없어요). 그래서 같은 동작을 앱 안에서 그대로 재현했어요 —
 * 고르는 창, "다음에도 이 지도로", 그리고 앱 안에서 되돌리기까지.
 *
 * 주소는 세 곳 모두 https 링크만 써요. 커스텀 스킴(kakaomap://, nmap://)은
 * 앱이 안 깔려 있으면 아무 일도 일어나지 않는데, 웹뷰에서는 그 실패를 알 수가
 * 없어서 사용자에게는 버튼이 고장 난 것처럼 보입니다. https 링크는 앱이 있으면
 * 앱으로, 없으면 웹으로 열려요.
 */

export type MapAppId = "naver" | "kakao" | "google";

export interface Destination {
  name: string;
  lat: number;
  lng: number;
}

export const MAP_APPS: { id: MapAppId; name: string }[] = [
  { id: "naver", name: "네이버지도" },
  { id: "kakao", name: "카카오맵" },
  { id: "google", name: "구글 지도" },
];

/** 고르지 않은 사람에게 쓰는 기본값. */
export const DEFAULT_MAP_APP: MapAppId = "naver";

const KEY = "open-clinic:map-app:v1";

export function mapAppName(id: MapAppId): string {
  return MAP_APPS.find((a) => a.id === id)?.name ?? id;
}

/**
 * 목적지까지의 길찾기 주소.
 *
 * 네이버는 도보 경로(pathType=3)를 지원하는 구형 주소를 써요. 이 주소가 실제로
 * `longitude`·`latitude` 를 그대로 받는다는 것은 서버 응답(302 Location)에서
 * 확인했어요 — `ex` 가 경도, `ey` 가 위도입니다. 신형 주소(map.naver.com/p)는
 * 좌표 순서를 확인할 방법이 없어서 쓰지 않았어요.
 */
export function directionsUrl(app: MapAppId, d: Destination): string {
  const name = encodeURIComponent(d.name);
  switch (app) {
    case "naver":
      return (
        `https://m.map.naver.com/route.nhn?menu=route&ename=${name}` +
        `&ex=${d.lng}&ey=${d.lat}&pathType=3&showMap=true`
      );
    case "kakao":
      return `https://map.kakao.com/link/to/${name},${d.lat},${d.lng}`;
    case "google":
      return (
        `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}` +
        `&travelmode=walking`
      );
  }
}

/* ------------------------------------------------------------------ */
/* 저장 — 막혀 있어도(시크릿 모드 등) 앱은 그냥 매번 물어봐요.            */
/* ------------------------------------------------------------------ */

export function isMapAppId(v: unknown): v is MapAppId {
  return MAP_APPS.some((a) => a.id === v);
}

export function savedMapApp(): MapAppId | null {
  try {
    const raw = localStorage.getItem(KEY);
    return isMapAppId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function rememberMapApp(id: MapAppId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* 다음에 또 물어보는 것뿐이에요. */
  }
}

/** 앱 안에서 "지도 앱 다시 고르기". OS 설정을 건드리는 게 아니라 이 값만 지워요. */
export function forgetMapApp(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/* ------------------------------------------------------------------ */
/* 자체 점검 — `npm run check:growth`                                   */
/* 좌표 순서가 뒤집히면 엉뚱한 곳으로 안내해요. 그건 꼭 잡아야 합니다.    */
/* ------------------------------------------------------------------ */
export function demo(): void {
  const dest: Destination = { name: "서울대학교병원", lat: 37.5704, lng: 126.9925 };

  const naver = directionsUrl("naver", dest);
  if (!naver.includes(`ex=${dest.lng}`)) throw new Error(`네이버: 경도가 ex 에 없어요 — ${naver}`);
  if (!naver.includes(`ey=${dest.lat}`)) throw new Error(`네이버: 위도가 ey 에 없어요 — ${naver}`);
  if (!naver.includes("pathType=3")) throw new Error("네이버: 도보 경로가 아니에요");

  // 카카오는 이름,위도,경도 순서예요(네이버와 순서가 반대라 헷갈리기 쉬워요).
  const kakao = directionsUrl("kakao", dest);
  if (!kakao.endsWith(`,${dest.lat},${dest.lng}`)) throw new Error(`카카오: 좌표 순서 — ${kakao}`);

  const google = directionsUrl("google", dest);
  if (!google.includes(`destination=${dest.lat},${dest.lng}`)) {
    throw new Error(`구글: 좌표 순서 — ${google}`);
  }

  // 이름은 반드시 인코딩돼야 해요 — 공백이 그대로 들어가면 링크가 깨져요.
  for (const app of MAP_APPS) {
    const url = directionsUrl(app.id, dest);
    if (url.includes(" ")) throw new Error(`${app.name}: 주소에 공백이 있어요`);
  }

  if (!isMapAppId("naver") || isMapAppId("nowhere")) throw new Error("isMapAppId 판정이 틀렸어요");
  if (mapAppName("naver") !== "네이버지도") throw new Error("이름 조회가 틀렸어요");
  if (DEFAULT_MAP_APP !== "naver") throw new Error("기본값은 네이버지도여야 해요");

  console.log("mapApps.ts OK");
}
