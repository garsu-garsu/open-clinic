export const AD_GROUP_ID_BANNER = import.meta.env.VITE_AD_GROUP_ID_BANNER ?? "";
export const AD_GROUP_ID_BANNER_IMAGE =
  import.meta.env.VITE_AD_GROUP_ID_BANNER_IMAGE ?? "";

/**
 * 카카오맵 JavaScript 키.
 * 없으면 지도를 숨기고 목록만 보여줘요 — 지도가 없어도 앱은 제 역할을 해요.
 *
 * ⚠️ 카카오 개발자센터 > 앱 설정 > 플랫폼 > Web 에 아래 두 도메인을 꼭 등록하세요.
 *    등록 안 하면 SDK 가 무한 로딩에 걸려요.
 *      https://open-clinic.apps.tossmini.com
 *      https://open-clinic.private-apps.tossmini.com
 */
export const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY ?? "";
