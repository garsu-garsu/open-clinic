import { eventLog } from "@apps-in-toss/web-framework";

type Primitive = string | number | boolean;
type Params = Record<string, Primitive | null | undefined>;
type LogType = "event" | "screen" | "click" | "impression";

function clean(p: Params): Record<string, Primitive> {
  const o: Record<string, Primitive> = {};
  for (const [k, v] of Object.entries(p)) if (v != null) o[k] = v;
  return o;
}

/** 콘솔 전환 지표용 로그. 미지원 환경(브라우저 개발)에선 조용히 지나가요. */
export function track(
  name: string,
  params: Params = {},
  type: LogType = "event",
): void {
  try {
    void eventLog({
      log_name: name,
      log_type: type,
      params: clean(params),
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

export function trackScreen(name: string, params: Params = {}): void {
  track(`screen_${name}`, params, "screen");
}

export const EVENT = {
  adBannerImpression: "ad_banner_impression",
  shareCompleted: "share_completed",
  // 앱 고유
  locationGranted: "location_granted",
  locationDenied: "location_denied",
  nearbyFound: "nearby_found",
  directionsOpened: "directions_opened",
  called: "called",
} as const;
