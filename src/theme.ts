// 의료 정보라 차분하게. 열림=파랑, 닫힘=회색, 모름=주황.
export const palette = {
  primary: "#1F6FEB",
  pharmacy: "#1E9E67",
  open: "#1B72C4",
  closed: "#8A9099",
  unknown: "#C97A16",
  ink: "#14181F",
  sub: "#69707A",
  line: "rgba(31,111,235,0.14)",
  card: "#FFFFFF",
  bg: "#F4F7FB",
  white: "#FFFFFF",
};

/** 색만으로 구분하지 않아요 — 글자로도 상태를 씁니다. */
export function stateStyle(state: "open" | "closed" | "unknown"): {
  color: string;
  label: string;
} {
  if (state === "open") return { color: palette.open, label: "지금 진료" };
  if (state === "closed") return { color: palette.closed, label: "지금 휴진" };
  return { color: palette.unknown, label: "시간 정보 없음" };
}

/** 지도 핀 색. 병원·의원은 파랑, 약국은 초록(약국 십자가 색 관행) — 종류를 색으로 구분해요. */
export function kindColor(kind: 0 | 1): string {
  return kind === 0 ? palette.primary : palette.pharmacy;
}
