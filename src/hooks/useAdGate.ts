import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";
import { useToast } from "@toss/tds-mobile";
import { useCallback, useEffect, useRef, useState } from "react";

import { EVENT, track } from "../lib/analytics";
import { AD_GROUP_ID_REWARDED } from "../lib/env";

/** 보상형 광고 게이트: "광고 보고 → 액션 실행". 미설정/미지원이면 즉시 통과(개발 편의). */
export function useAdGate() {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const supportedRef = useRef(false);
  const unloadRef = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    if (AD_GROUP_ID_REWARDED === "") return;
    try {
      if (!loadFullScreenAd.isSupported()) return;
      supportedRef.current = true;
      unloadRef.current = loadFullScreenAd({
        options: { adGroupId: AD_GROUP_ID_REWARDED },
        onEvent: (e) => {
          if (e.type === "loaded") setReady(true);
        },
        onError: (err) => console.error("광고 로드 실패:", err),
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    load();
    return () => unloadRef.current?.();
  }, [load]);

  const watchThen = useCallback(
    (onReward: () => void, context?: string) => {
      if (AD_GROUP_ID_REWARDED === "" || !supportedRef.current) {
        onReward();
        return;
      }
      if (!ready) {
        toast.openToast("광고를 준비 중이에요. 잠시 후 다시 시도해 주세요.");
        load();
        return;
      }
      let rewarded = false;
      try {
        showFullScreenAd({
          options: { adGroupId: AD_GROUP_ID_REWARDED },
          onEvent: (e) => {
            if (e.type === "userEarnedReward") {
              rewarded = true;
              track(EVENT.adRewarded, { context: context ?? "" });
            } else if (e.type === "dismissed") {
              setReady(false);
              load();
              // 보상 없이 닫으면 실행하지 않아요. 다만 아무 반응이 없으면
              // 버튼이 고장 난 것처럼 보이니 이유를 알려줘요.
              if (rewarded) onReward();
              else toast.openToast("광고를 끝까지 봐야 열려요.");
            } else if (e.type === "failedToShow") {
              setReady(false);
              load();
              toast.openToast("광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
            }
          },
          onError: (err) => {
            console.error(err);
            setReady(false);
            load();
            toast.openToast("광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
          },
        });
      } catch (err) {
        console.error(err);
        toast.openToast("광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    },
    [ready, load, toast],
  );

  return { ready, watchThen };
}
