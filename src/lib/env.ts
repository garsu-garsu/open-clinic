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
export const AD_GROUP_ID_REWARDED =
  import.meta.env.VITE_AD_GROUP_ID_REWARDED ?? "";

/**
 * 배경지도 타일 주소.
 *
 * OpenStreetMap 을 씁니다. 인증키도 도메인 등록도 필요 없고,
 * 앱인토스에서 실제로 도는 게 확인된 경로예요(그늘로가 이걸 씁니다).
 *
 * ⚠️ OSM 공식 타일 서버는 이용 정책상 대량 트래픽을 허용하지 않아요.
 *    사용자가 늘면 타일 제공자를 따로 두거나 직접 호스팅해야 합니다.
 *    ponytail: 출시하고 실제로 트래픽이 붙으면 그때 옮기세요.
 */
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_ATTRIBUTION = "© OpenStreetMap 기여자";
