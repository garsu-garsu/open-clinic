import { BannerAd } from "./components/BannerAd";
import { HomeScreen } from "./features/home/HomeScreen";
import { AD_GROUP_ID_BANNER } from "./lib/env";

/**
 * 화면이 하나뿐인 앱이에요. 급할 때 여는 앱에 탐색 단계를 두면 안 돼요.
 * 배너는 화면 하단에 고정으로 하나만 띄웁니다.
 */
export default function App() {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <HomeScreen />
      </div>
      {/* 배너 그룹 ID가 없으면 BannerAd 는 null 을 그려요. 근데 이 컨테이너가
          그대로 96px + 안전영역만큼 자리를 잡고 있으면, 광고가 없는 지금
          그냥 빈 흰 여백만 하단 탭 아래 크게 남아요. 광고를 아예 안 붙일 때는
          자리 자체를 안 만듭니다. */}
      {AD_GROUP_ID_BANNER !== "" && (
        <div
          style={{
            flexShrink: 0,
            height: 96,
            paddingBottom: "env(safe-area-inset-bottom)",
            background: "#FFFFFF",
          }}
        >
          <BannerAd />
        </div>
      )}
    </div>
  );
}
