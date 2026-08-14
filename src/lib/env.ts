/**
 * 공공데이터포털 인증키. 병·의원/약국 정보를 앱이 직접 불러오는 데 써요.
 *
 * ⚠️ Vite 는 VITE_ 접두어가 붙은 값을 그대로 번들에 넣어요. 즉 이 키는
 *    브라우저로 배포되는 코드 안에 그대로 노출됩니다. 공공데이터포털 키는
 *    트래픽 제한(일일 호출 한도)만 있고 결제·개인정보 권한이 없는 무료 키라
 *    노출 절충이 받아들여진 상태예요. 서버를 두는 방식으로 바꾸려면
 *    이 키를 백엔드로 옮기고 프록시를 하나 세우면 됩니다.
 */
export const DATA_KEY = import.meta.env.VITE_DATA_KEY ?? "";

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
