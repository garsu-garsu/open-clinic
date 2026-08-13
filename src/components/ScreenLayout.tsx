import type { CSSProperties, ReactNode } from "react";

import { palette } from "../theme";

/** 흰 카드 컨테이너. */
export function Card({
  children,
  style,
  onClick,
}: {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: palette.card,
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 2px 12px rgba(27,29,33,0.06)",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
