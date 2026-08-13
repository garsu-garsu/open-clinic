import { BannerAd } from "./components/BannerAd";
import { HomeScreen } from "./features/home/HomeScreen";

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
    </div>
  );
}
