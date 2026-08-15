import { useEffect, useState, type RefObject } from "react";

export interface CoachStep {
  /** 가리킬 요소. 생략하면 설명만 있는 화면 전체 인사 단계가 돼요. */
  ref?: RefObject<HTMLElement | null>;
  title: string;
  body: string;
}

interface Props {
  /** localStorage 키. 단계를 바꾸면 버전을 올려서(v2) 다시 보여줄 수 있어요. */
  storageKey: string;
  steps: CoachStep[];
}

/**
 * 코치마크 온보딩. 화면 요소를 하나씩 가리키며 설명하고, 처음 한 번만 떠요.
 * 네 앱(급똥·오늘바다·진료중·약궁합) 공용 컴포넌트라 이 앱만의 로직·색은 없어요.
 *
 * ⚠️ 이 컴포넌트는 위치를 잡고 화면이 준비된 뒤에만 렌더링하세요 —
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
    setVisible(steps.filter((s) => s.ref == null || s.ref.current != null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const step = visible?.[index] ?? null;

  // 구멍 위치 계산 + 화면 회전·크기 변화·스크롤에 따라오게.
  useEffect(() => {
    if (step?.ref?.current == null) {
      setRect(null);
      return;
    }
    const el = step.ref.current;
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  if (dismissed !== false || visible == null || visible.length === 0 || step == null) return null;

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
  const spotlight = rect && {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  // 말풍선 높이는 대략 이 정도예요. 구멍이 화면 대부분을 덮는 단계(지도 등)에서
  // 아래로 붙이면 화면 밖으로 밀려나서, 위/아래 중 자리가 더 넓은 쪽에 붙이고
  // 화면 안에 들어오게 눌러줘요.
  const bubbleH = 200;
  const maxTop = Math.max(16, window.innerHeight - bubbleH - 16);
  let bubbleTop: number | undefined;
  if (spotlight) {
    const spaceBelow = window.innerHeight - (spotlight.top + spotlight.height);
    const preferBelow = spaceBelow >= spotlight.top;
    bubbleTop = preferBelow ? spotlight.top + spotlight.height + 12 : spotlight.top - bubbleH - 12;
    bubbleTop = Math.min(Math.max(bubbleTop, 16), maxTop);
  }

  return (
    <div
      onClick={next}
      role="button"
      aria-label="다음"
      style={{ position: "fixed", inset: 0, zIndex: 3000, cursor: "pointer" }}
    >
      {spotlight ? (
        <div
          style={{
            position: "fixed",
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: 16,
            // 이 그림자 트릭 하나로 "구멍 뚫린 어두운 오버레이"가 완성돼요.
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          }}
        />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: 16,
          right: 16,
          top: bubbleTop ?? "50%",
          transform: bubbleTop == null ? "translateY(-50%)" : undefined,
          background: "#fff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        }}
      >
        <p style={{ fontSize: 13, color: "#8B93A1", margin: "0 0 6px", fontWeight: 700 }}>
          {index + 1} / {visible.length}
        </p>
        <p style={{ fontSize: 19, fontWeight: 800, color: "#1B1D21", margin: "0 0 8px" }}>{step.title}</p>
        <p style={{ fontSize: 16, color: "#333A44", margin: "0 0 18px", lineHeight: 1.5 }}>{step.body}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={finish}
            style={{ border: "none", background: "none", fontSize: 15, color: "#8B93A1", padding: 8 }}
          >
            건너뛰기
          </button>
          <button
            onClick={next}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 22px",
              fontSize: 16,
              fontWeight: 700,
              color: "#fff",
              background: "#2F6FED",
            }}
          >
            {index + 1 === visible.length ? "시작하기" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
