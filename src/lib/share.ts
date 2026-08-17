/**
 * 공유.
 *
 * 명절이나 주말 밤에 "여기 문 열었대" 를 그대로 보낼 수 있게 해요. 받은 사람이
 * 링크를 누르면 이 미니앱이 열려서, 새 사용자가 들어오는 길이 됩니다.
 *
 * 병원을 추천하는 게 아니라 사용자가 고른 곳의 공개 정보(이름·전화·오늘 진료시간)만
 * 담아요. 실패해도 조용히 넘어가요.
 */
import { getTossShareLink, Share } from "@apps-in-toss/web-framework";

import { EVENT, track } from "./analytics.ts";
import { formatDistance } from "./geo.ts";
import type { Place } from "./places.ts";
import { todayLabel } from "./schedule.ts";

async function tossLink(): Promise<string> {
  try {
    return await getTossShareLink("intoss://open-clinic");
  } catch (err) {
    console.error("공유 링크 생성 실패:", err);
    return "";
  }
}

export async function sharePlace(p: Place): Promise<void> {
  const link = await tossLink();
  const message = [
    `${p.name}`,
    todayLabel(p.week),
    p.tel === "" ? "" : `전화 ${p.tel}`,
    `${formatDistance(p.distance)} 거리`,
    link,
  ]
    .filter((s) => s !== "")
    .join("\n");

  try {
    await Share.sendMessage({ message });
    track(EVENT.shareCompleted, { name: p.name });
  } catch (err) {
    console.error("공유 실패:", err);
  }
}
