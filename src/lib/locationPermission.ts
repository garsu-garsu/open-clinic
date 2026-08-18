/**
 * 위치 권한 상태 조회.
 *
 * 토스 앱에서 위치 권한을 처음 요청하면 **바텀시트**가 뜹니다. 앱을 켜자마자
 * 위치를 잡으면 그 시트가 진입 직후 자동으로 열리는 셈이라, 심사 규정
 * ("미니앱에 들어오자마자 바텀시트가 자동으로 열리지 않아요")에 걸려요.
 * 실제로 진료중·오늘바다가 이 사유로 반려됐고, 위치를 쓰지 않는 약궁합만
 * 같은 판에서 승인됐습니다.
 *
 * 그래서 진입 시에는 조회만 합니다. `getPermission` 은 창을 띄우지 않아요.
 *   - 이미 허용돼 있으면 예전처럼 바로 위치를 잡습니다(시트가 뜨지 않아요).
 *   - 아직 아니면 화면에 버튼을 두고, 사용자가 누를 때 요청합니다.
 */
import { Device } from "@apps-in-toss/web-framework";

export async function isLocationAllowed(): Promise<boolean> {
  try {
    return (await Device.getLocation.getPermission()) === "allowed";
  } catch {
    // 미지원 환경(브라우저 개발 등)에서는 버튼을 보여주는 쪽으로 둡니다.
    return false;
  }
}
