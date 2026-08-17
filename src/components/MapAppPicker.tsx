/**
 * 어느 지도로 안내받을지 고르는 창.
 *
 * 안드로이드 앱 선택창을 앱 안에서 재현한 거예요 — 앱 목록 + "다음에도 이
 * 지도로". 체크를 켜고 고르면 그 지도를 기억하고, 다음부터는 이 창이 뜨지
 * 않아요. 되돌리는 건 목록 화면 아래 "지도 앱 다시 고르기" 로 합니다.
 *
 * ⚠️ 길찾기 버튼을 눌렀을 때만 열려요. 진입 직후에 뜨는 창은 심사 반려
 *    사유예요(급똥 2026-08-17 반려 이력).
 */
import { useState } from "react";

import { MAP_APPS, type MapAppId } from "../lib/mapApps";
import { palette } from "../theme";

export function MapAppPicker({
  onPick,
  onClose,
}: {
  /** remember 가 true 면 다음부터 이 지도로 바로 열어요. */
  onPick: (id: MapAppId, remember: boolean) => void;
  onClose: () => void;
}) {
  const [remember, setRemember] = useState(false);

  return (
    <>
      {/* 뒤를 눌러도 닫혀요. 화면을 가로막고 끝나는 창을 만들지 않아요. */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(27,29,33,0.45)",
          zIndex: 1200,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: "calc(92px + env(safe-area-inset-bottom))",
          zIndex: 1201,
          background: palette.card,
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 6px 24px rgba(27,29,33,0.28)",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 800, color: palette.ink, marginBottom: 4 }}>
          어느 지도로 안내할까요?
        </div>
        <div style={{ fontSize: 13, color: palette.sub, marginBottom: 12 }}>
          깔려 있는 앱으로 열려요. 없으면 웹으로 열립니다.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MAP_APPS.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => onPick(app.id, remember)}
              style={{
                width: "100%",
                border: `1px solid ${palette.line}`,
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 16,
                fontWeight: 700,
                color: palette.ink,
                background: palette.card,
                textAlign: "left",
              }}
            >
              {app.name}
            </button>
          ))}
        </div>

        {/* 체크박스는 글자까지 눌러도 켜지게 label 로 감쌌어요(손가락이 큰 화면). */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
            fontSize: 15,
            color: palette.ink,
          }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ width: 20, height: 20 }}
          />
          다음에도 이 지도로 열기
        </label>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 12,
            border: "none",
            background: "transparent",
            padding: "10px 0",
            fontSize: 15,
            fontWeight: 700,
            color: palette.sub,
          }}
        >
          취소
        </button>
      </div>
    </>
  );
}
