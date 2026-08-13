import { useEffect, useRef, useState } from "react";

import { KAKAO_JS_KEY } from "../lib/env";
import type { LatLng } from "../lib/geo";
import type { Place } from "../lib/places";
import { palette, stateStyle } from "../theme";

/* 카카오 SDK 는 타입 선언이 없어요. 쓰는 부분만 좁게 열어둡니다. */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: any;
  }
}

/** 스크립트를 한 번만 넣어요. 탭을 오갈 때마다 넣으면 지도가 여러 번 뜹니다. */
let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (sdkPromise != null) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (KAKAO_JS_KEY === "") {
      reject(new Error("no-key"));
      return;
    }
    const el = document.createElement("script");
    // autoload=false 로 받아야 kakao.maps.load 로 준비 시점을 잡을 수 있어요.
    el.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;
    el.async = true;
    el.onload = () => window.kakao.maps.load(() => resolve());
    // 카카오 개발자센터에 tossmini.com 도메인을 등록 안 하면 여기로 떨어져요.
    el.onerror = () => reject(new Error("sdk-load-failed"));
    document.head.appendChild(el);
  });
  return sdkPromise;
}

interface Props {
  me: LatLng;
  toilets: Place[];
  /** 반경(m). 지도에 원으로 그리고, 그 원이 딱 들어오게 배율을 맞춰요. */
  radius: number;
  onSelect: (p: Place) => void;
}

export function MapView({ me, toilets, radius, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circleRef = useRef<any>(null);
  const [failed, setFailed] = useState(KAKAO_JS_KEY === "");

  // 클릭 핸들러가 최신 목록을 보게 해요. 이벤트를 한 번만 걸기 때문에
  // 목록을 클로저로 잡으면 첫 목록에 고정돼요.
  const dataRef = useRef({ toilets, onSelect });
  dataRef.current = { toilets, onSelect };

  useEffect(() => {
    let alive = true;
    loadSdk()
      .then(() => {
        if (!alive || boxRef.current == null) return;
        const kakao = window.kakao;
        const map = new kakao.maps.Map(boxRef.current, {
          center: new kakao.maps.LatLng(me.lat, me.lng),
          level: 5,
        });
        mapRef.current = map;

        // 내 위치는 작은 원으로. 마커로 찍으면 화장실 핀과 헷갈려요.
        new kakao.maps.Circle({
          center: new kakao.maps.LatLng(me.lat, me.lng),
          radius: 20,
          strokeWeight: 3,
          strokeColor: palette.primary,
          strokeOpacity: 0.9,
          fillColor: palette.primary,
          fillOpacity: 0.4,
        }).setMap(map);

        // 핀 클릭은 오버레이 DOM 에 직접 걸어요.
        // (CustomOverlay 는 kakao.maps.event 로 클릭을 못 받아요)
        boxRef.current.addEventListener("click", (e) => {
          const el = (e.target as HTMLElement).closest("[data-pin]");
          if (el == null) return;
          const idx = Number(el.getAttribute("data-pin"));
          const t = dataRef.current.toilets[idx];
          if (t != null) dataRef.current.onSelect(t);
        });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [me.lat, me.lng]);

  // 반경 원 + 배율
  useEffect(() => {
    const map = mapRef.current;
    if (map == null) return;
    const kakao = window.kakao;

    circleRef.current?.setMap(null);
    const circle = new kakao.maps.Circle({
      center: new kakao.maps.LatLng(me.lat, me.lng),
      radius,
      strokeWeight: 2,
      strokeColor: palette.primary,
      strokeOpacity: 0.5,
      strokeStyle: "shortdash",
      fillColor: palette.primary,
      fillOpacity: 0.06,
    });
    circle.setMap(map);
    circleRef.current = circle;

    // 원의 경계 상자에 맞춰요. 반경을 바꾸면 배율도 따라와야 자연스러워요.
    const dLat = radius / 111_000;
    const dLng = radius / (111_000 * Math.cos((me.lat * Math.PI) / 180));
    map.setBounds(
      new kakao.maps.LatLngBounds(
        new kakao.maps.LatLng(me.lat - dLat, me.lng - dLng),
        new kakao.maps.LatLng(me.lat + dLat, me.lng + dLng),
      ),
    );
  }, [radius, me.lat, me.lng]);

  // 목록이 바뀌면 핀을 갈아끼워요.
  useEffect(() => {
    const map = mapRef.current;
    if (map == null) return;
    const kakao = window.kakao;

    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = toilets.map((t, idx) => {
      const { color } = stateStyle(t.state);
      const marker = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(t.lat, t.lng),
        content: pinHtml(color, idx),
        yAnchor: 0.5,
        clickable: true,
      });
      marker.setMap(map);
      return marker;
    });
  }, [toilets]);

  // 키가 없거나 SDK 가 안 뜨면 지도 대신 안내를 둬요.
  // 이 앱의 본체는 목록이라 지도가 죽어도 쓸 수 있어야 해요.
  if (failed) {
    return (
      <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 24 }}>
        <p style={{ fontSize: 15, color: palette.sub, textAlign: "center", lineHeight: 1.6 }}>
          지도를 불러오지 못했어요.
          <br />
          아래 <b>목록</b> 탭에서 가까운 순으로 볼 수 있어요.
        </p>
      </div>
    );
  }

  return <div ref={boxRef} style={{ width: "100%", height: "100%", background: "#E8ECF1" }} />;
}

/** data-pin 은 클릭 핸들러가 목록 인덱스를 되찾는 데 써요. */
function pinHtml(color: string, idx: number): string {
  return (
    `<div data-pin="${idx}" style="width:24px;height:24px;border-radius:50%;` +
    `background:${color};border:3px solid #fff;` +
    `box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`
  );
}
