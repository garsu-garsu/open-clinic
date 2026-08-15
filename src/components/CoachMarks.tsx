import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";

export interface CoachStep {
  /** 가리킬 요소. 화면에 없으면 그 단계는 조용히 빠져요. */
  ref: RefObject<HTMLElement | null>;
  title: string;
  body: string;
}

interface Props {
  /** localStorage 키. 단계를 바꾸면 버전을 올려서(v2) 다시 보여줄 수 있어요. */
  storageKey: string;
  steps: CoachStep[];
}

/**
 * 코치마크 온보딩. 대상만 남기고 화면을 어둡게 덮어요. 처음 한 번만 떠요.
 *
 * ⚠️ 흰 카드를 띄우거나 화면 클릭을 가로채면 안 돼요.
 *    앱인토스 심사가 "진입 즉시 화면을 가로막는 창"을 다크패턴으로 보고
 *    바텀시트로 간주해 반려합니다(급똥 2026-08-15 반려 사유 — 둥근 흰 카드에
 *    버튼을 담고 전체 클릭을 먹던 버전). 이미 출시된 로또·돛단배·오늘의다수결이
 *    쓰는 형태를 따랐어요: 덮개는 pointer-events 를 흘려보내 뒤 화면이 그대로
 *    눌리고, 어두운 배경 위에 흰 글씨만 얹습니다. 자동으로 뜨는 건 괜찮아요.
 *
 * ⚠️ 위치를 잡고 화면이 준비된 뒤에만 렌더링하세요 —
 *    (예: `{phase.k === "ready" && <CoachMarks ... />}`) 여기서는 그 판단을 안 해요.
 */
export function CoachMarks({ storageKey, steps }: Props) {
  // null: 아직 localStorage 확인 전(안 그림). false/true: 확인 끝.
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  // 가리킬 요소가 이 화면에 없는(ref.current 없는) 단계는 미리 걸러내요.
  const [visible, setVisible] = useState<CoachStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false); // localStorage 가 막혀 있으면 매번 뜨는 쪽을 택해요. 앱이 죽으면 안 돼요.
    }
    // ref 는 부모가 이미 렌더링을 마친 뒤라(같은 커밋) mount 시점 effect 에서 읽으면 안전해요.
    setVisible(steps.filter((s) => s.ref.current != null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const step = visible?.[index] ?? null;

  // 구멍 위치 계산 + 화면 회전·크기 변화·스크롤에 따라오게.
  useEffect(() => {
    // 단계가 바뀌면 이전 단계 위치는 버리고 새로 찾아요.
    setRect(null);
    const el = step?.ref.current;
    if (el == null) return;
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  if (dismissed !== false || visible == null || step == null || rect == null) return null;

  const finish = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* 막혀 있으면 그냥 넘어가요 — 다음에 또 뜨는 것뿐, 앱이 죽으면 안 돼요. */
    }
    setDismissed(true);
  };
  const next = () => (index + 1 < visible.length ? setIndex(index + 1) : finish());

  const pad = 8;
  // 제목·설명·진행표시·버튼을 합치면 160px 쯤 돼요. 그만큼 위가 비어 있을 때만
  // 위에 두고, 아니면 아래에 둡니다.
  const textH = 160;
  const above = rect.top - pad > textH + 16;
  // 지도처럼 구멍이 화면을 거의 다 덮는 단계에서는 아래로 붙이면 화면 밖으로
  // 밀려나요. 어디에 붙이든 화면 안에는 들어오게 눌러줍니다.
  const textTop = Math.min(
    Math.max(above ? rect.top - pad - textH : rect.bottom + pad + 16, 16),
    Math.max(16, window.innerHeight - textH - 16),
  );

  return createPortal(
    // pointer-events 를 흘려보내야 해요. 여기서 클릭을 먹으면 화면을 가로막는
    // 창이 되고, 그게 심사에서 바텀시트로 잡힙니다.
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          borderRadius: 16,
          // 이 그림자 트릭 하나로 "구멍 뚫린 어두운 오버레이"가 완성돼요.
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: textTop,
          left: 20,
          right: 20,
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 800,
            color: "#FFFFFF",
            lineHeight: 1.4,
            textShadow: "0 1px 6px rgba(0,0,0,0.55)",
          }}
        >
          {step.title}
        </p>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "rgba(255,255,255,0.88)",
            lineHeight: 1.5,
            textShadow: "0 1px 6px rgba(0,0,0,0.55)",
          }}
        >
          {step.body}
        </p>
        {/* 한 단계뿐이면 "1 / 1" 은 알려주는 게 없어요. */}
        {visible.length > 1 && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {index + 1} / {visible.length}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 6 }}>
          {/* 이 두 개만 실제로 눌려요. 나머지는 뒤 화면이 그대로 받습니다. */}
          <button type="button" onClick={finish} style={linkStyle("rgba(255,255,255,0.75)")}>
            건너뛰기
          </button>
          <button type="button" onClick={next} style={linkStyle("#FFFFFF")}>
            {index + 1 === visible.length ? "다 봤어요" : "다음"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function linkStyle(color: string): CSSProperties {
  return {
    pointerEvents: "auto",
    border: "none",
    background: "none",
    padding: 8,
    fontSize: 15,
    fontWeight: 700,
    color,
    textDecoration: "underline",
    cursor: "pointer",
  };
}
