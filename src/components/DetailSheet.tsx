import { formatDistance } from "../lib/geo";
import type { Place } from "../lib/places";
import { weekLines } from "../lib/schedule";
import { palette, stateStyle } from "../theme";

/**
 * 핀을 눌렀을 때 뜨는 상세. 지도 위에 겹치는 얕은 카드예요 —
 * 딤이 있는 바텀시트를 쓰면 지도를 못 움직입니다.
 */
export function DetailSheet({
  p,
  onClose,
  onGo,
  onCall,
}: {
  p: Place;
  onClose: () => void;
  onGo: () => void;
  onCall: () => void;
}) {
  const s = stateStyle(p.state);
  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        // Leaflet 이 타일·마커를 400~700 에 깔아요. z-index 를 안 주면 이 카드가
        // 지도 밑으로 들어가서, 핀을 눌러도 아무 일도 안 일어난 것처럼 보입니다.
        zIndex: 1000,
        maxHeight: "70%",
        overflowY: "auto",
        background: palette.card,
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 6px 24px rgba(20,24,31,0.22)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: palette.ink }}>{p.name}</div>
          <div style={{ fontSize: 14, color: palette.sub, marginTop: 4 }}>
            {formatDistance(p.distance)}
            {p.dept !== "" && ` · ${p.dept}`}
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="닫기"
          style={{ border: "none", background: "transparent", fontSize: 20, color: palette.sub, padding: 4 }}
        >
          ✕
        </button>
      </div>

      {/* 주간 진료시간 — 오늘만 보여주면 "내일 가도 되나"를 알 수 없어요. */}
      <div style={{ marginTop: 12, borderTop: `1px solid ${palette.line}`, paddingTop: 10 }}>
        {weekLines(p.week).map(({ day, span }) => (
          <div key={day} style={{ display: "flex", fontSize: 14, padding: "3px 0" }}>
            <span style={{ width: 48, color: palette.sub }}>{day}</span>
            <span style={{ color: span === "휴무" ? palette.sub : palette.ink }}>{span}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {p.tel !== "" && (
          <button
            onClick={onCall}
            style={{
              flex: 1,
              border: `1.5px solid ${palette.primary}`,
              borderRadius: 12,
              padding: "14px 0",
              fontSize: 16,
              fontWeight: 700,
              color: palette.primary,
              background: palette.white,
            }}
          >
            전화
          </button>
        )}
        <button
          onClick={onGo}
          style={{
            flex: 1,
            border: "none",
            borderRadius: 12,
            padding: "14px 0",
            fontSize: 16,
            fontWeight: 700,
            color: palette.white,
            background: palette.primary,
          }}
        >
          길찾기
        </button>
      </div>
    </div>
  );
}
