import { HomeScreen } from "./features/home/HomeScreen";

/**
 * 화면이 하나뿐인 앱이에요. 급할 때 여는 앱에 탐색 단계를 두면 안 돼요.
 * 하단 고정 배너는 HomeScreen 이 phase 상태를 보고 준비된 뒤에만 띄워요.
 */
export default function App() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <HomeScreen />
    </div>
  );
}
