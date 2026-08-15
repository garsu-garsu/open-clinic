import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

import { TILE_ATTRIBUTION, TILE_URL } from "../lib/env";
import type { LatLng } from "../lib/geo";
import type { Place } from "../lib/places";
import { kindColor, palette } from "../theme";

interface Props {
  me: LatLng;
  places: Place[];
  /** 반경(m). 지도에 원으로 그리고, 그 원이 딱 들어오게 배율을 맞춰요. */
  radius: number;
  onSelect: (p: Place) => void;
}

/**
 * 지도에 찍는 핀의 최대 개수.
 *
 * 서울 도심은 3km 안에 병원이 800곳 넘게 있어요. 다 찍으면 핀끼리 겹쳐서
 * 도로도 지명도 안 보이는 파란 덩어리가 됩니다. 지도를 켜는 이유가
 * "어디쯤 있나"를 보는 건데 그러면 아무것도 알 수 없어요.
 * 목록은 그대로 전부 보여주고, 지도에서만 잘라 찍습니다.
 *
 * ponytail: 50개 고정. 더 촘촘히 보여줘야 하면 배율에 따라 개수를 늘리거나
 *           마커 묶음(클러스터)을 붙이세요. 지금은 그럴 만한 이유가 없어요.
 */
const MAX_PINS = 50;

/**
 * 반경을 몇 칸으로 쪼갤지. 거리순 상위 MAX_PINS 개만 뽑으면 도심에서는
 * 다 1km 안쪽에 몰려서 반경을 넓혀도 지도가 그대로예요 — 반경 전체에
 * 고르게 퍼뜨려야 반경을 바꾼 게 지도에 보입니다.
 */
const GRID_CELLS_ACROSS = 10;

/** 반경을 격자로 나눠 칸마다 가장 가까운 곳만 남겨요(칸 하나 = 한 핀). */
function spreadOut(sortedByDistance: Place[], me: LatLng, radius: number, max: number): Place[] {
  const cellM = (radius * 2) / GRID_CELLS_ACROSS;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((me.lat * Math.PI) / 180);

  const seen = new Set<string>();
  const picked: Place[] = [];
  for (const p of sortedByDistance) {
    const x = Math.floor(((p.lng - me.lng) * mPerLng) / cellM);
    const y = Math.floor(((p.lat - me.lat) * mPerLat) / cellM);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(p);
    if (picked.length >= max) break;
  }
  return picked;
}

/**
 * 지도.
 *
 * 이 앱에서 지도가 하는 일은 핀 찍기와 반경 원 그리기가 전부예요.
 * 그래서 지도사 SDK 대신 Leaflet(약 40KB) + 타일 주소 한 줄로 끝냅니다 —
 * 인증키도 도메인 등록도 필요 없고, 타일 주소만 바꾸면 지도를 통째로 갈 수 있어요.
 */

export function MapView({ me, places, radius, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const meHaloRef = useRef<L.CircleMarker | null>(null);
  const meDotRef = useRef<L.CircleMarker | null>(null);
  const [tileFailed, setTileFailed] = useState(false);

  // 클릭 핸들러가 최신 목록을 보게 해요. 마커를 다시 만들 때마다
  // 콜백을 새로 묶지 않으려고 ref 로 넘깁니다.
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  // 지도 만들기 — 한 번만.
  useEffect(() => {
    if (boxRef.current == null || mapRef.current != null) return;

    const map = L.map(boxRef.current, {
      center: [me.lat, me.lng],
      zoom: 15,
      zoomControl: false,
      // 급할 때 쓰는 화면이라 회전·기울임 같은 건 없는 게 나아요.
      attributionControl: true,
    });
    mapRef.current = map;

    const tiles = L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
    });
    /*
     * 타일이 통째로 막히면(호출 한도, 네트워크 차단 등) 빈 화면만 남아요.
     * 그때만 안내를 띄우고 목록 탭으로 보냅니다.
     *
     * 한두 장 실패로 판정하면 안 돼요 — 타일은 원래 가끔 빠지는데,
     * 지도가 멀쩡히 그려진 위에 "못 불러왔어요" 를 덮으면 더 이상합니다.
     * 한 장이라도 떴으면 지도는 쓸 수 있는 상태예요.
     */
    let anyLoaded = false;
    tiles.on("tileload", () => {
      anyLoaded = true;
    });
    tiles.on("tileerror", () => {
      if (!anyLoaded) setTileFailed(true);
    });
    tiles.addTo(map);

    markersRef.current = L.layerGroup().addTo(map);

    // 내 위치는 점 + 후광으로. 병원·약국은 장소를 가리키는 물방울 핀이라
    // 모양 자체가 달라서 크기로만 구분하지 않아도 헷갈리지 않아요.
    // circleMarker 는 markerPane(z-index 600)보다 낮은 overlayPane(400)에 그려져서
    // bringToFront() 를 해도 핀 아래 깔려요. 핀보다 위인 전용 pane 을 만들어 그 안에 둡니다.
    // 클릭 대상이 아니니 interactive:false 로 눌러도 뒤 지도가 반응하게 둬요.
    const mePane = map.createPane("me");
    mePane.style.zIndex = "650";
    meHaloRef.current = L.circleMarker([me.lat, me.lng], {
      pane: "me",
      interactive: false,
      radius: 16,
      stroke: false,
      fillColor: palette.primary,
      fillOpacity: 0.25,
    }).addTo(map);
    meDotRef.current = L.circleMarker([me.lat, me.lng], {
      pane: "me",
      interactive: false,
      radius: 6,
      color: "#fff",
      weight: 3,
      fillColor: palette.primary,
      fillOpacity: 1,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [me.lat, me.lng]);

  // 반경 원 + 배율
  useEffect(() => {
    const map = mapRef.current;
    if (map == null) return;

    // 지도는 처음 한 번만 만들어져서, "다시 찾기"로 위치가 바뀌면
    // 내 위치 점 + 후광도 여기서 같이 옮겨줘야 해요.
    meHaloRef.current?.setLatLng([me.lat, me.lng]);
    meDotRef.current?.setLatLng([me.lat, me.lng]);

    circleRef.current?.remove();
    const circle = L.circle([me.lat, me.lng], {
      radius,
      color: palette.primary,
      weight: 2,
      opacity: 0.5,
      dashArray: "6 6",
      fillColor: palette.primary,
      fillOpacity: 0.06,
    }).addTo(map);
    circleRef.current = circle;

    // 반경을 바꾸면 배율도 따라와야 자연스러워요. 핀은 격자로 반경 전체에
    // 퍼뜨려 찍으니(spreadOut), 원에 맞춰도 가운데만 뭉치지 않아요.
    map.fitBounds(circle.getBounds(), { padding: [24, 24] });
  }, [radius, me.lat, me.lng]);

  // 목록이 바뀌면 핀을 갈아끼워요.
  useEffect(() => {
    const layer = markersRef.current;
    if (layer == null) return;
    layer.clearLayers();

    const byDistance = [...places].sort((a, b) => a.distance - b.distance);
    const shown = spreadOut(byDistance, me, radius, MAX_PINS);
    for (const p of shown) {
      // 닫힌 곳도 지도에는 보여주되 흐리게 해요. 지금 갈 수 있는 곳이
      // 먼저 눈에 들어와야 하니까요. 목록에서 빼버리면 "저기 있는데 왜 안 보이지"가 돼요.
      const dim = p.state === "closed" ? 0.5 : p.state === "unknown" ? 0.8 : 1;
      L.marker([p.lat, p.lng], {
        icon: pinIcon(kindColor(p.kind), dim),
        // 열린 핀이 겹쳤을 때 위로 오게.
        zIndexOffset: p.state === "open" ? 1000 : 0,
      })
        .on("click", () => selectRef.current(p))
        .addTo(layer);
    }
    meHaloRef.current?.bringToFront();
    meDotRef.current?.bringToFront();
  }, [places, me.lat, me.lng, radius]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={boxRef} style={{ width: "100%", height: "100%", background: "#E8ECF1" }} />

      {/*
        잘라서 찍었으면 그 사실을 알려줘야 해요. 말없이 빼면 "분명 목록엔
        있었는데 지도엔 왜 없지" 가 됩니다.
      */}
      {places.length > MAX_PINS && !tileFailed && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(255,255,255,.92)",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 12,
            color: palette.sub,
            boxShadow: "0 1px 4px rgba(0,0,0,.2)",
            whiteSpace: "nowrap",
          }}
        >
          일부만 표시 · 전체는 목록에서
        </div>
      )}

      {tileFailed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            // 불투명해야 해요. 반투명이면 빈 지도 위로 핀이 비쳐서
            // 안내인지 지도인지 알 수 없는 화면이 됩니다.
            background: palette.bg,
            // Leaflet 마커 pane 이 600 이라 그보다 위여야 안내가 가려지지 않아요.
            zIndex: 1000,
            padding: 24,
          }}
        >
          <p style={{ fontSize: 15, color: palette.sub, textAlign: "center", lineHeight: 1.7, margin: 0 }}>
            지도를 불러오지 못했어요.
            <br />
            아래 <b>목록</b> 탭에서 가까운 순으로 볼 수 있어요.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 핀. Leaflet 기본 마커는 이미지 파일을 따로 물어서(번들 경로가 깨지기 쉬워요)
 * div 아이콘으로 직접 그립니다.
 *
 * 땅의 한 지점을 가리키는 물방울 모양이라 "내 위치" 점과 헷갈리지 않아요.
 * 뾰족한 끝이 실제 좌표라서 iconAnchor 를 거기에 맞춰요.
 */
const PIN_W = 28;
const PIN_H = 36;

function pinIcon(color: string, opacity = 1): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `
      <div style="width:${PIN_W}px;height:${PIN_H}px;opacity:${opacity};filter:drop-shadow(0 1px 3px rgba(0,0,0,.35))">
        <svg width="${PIN_W}" height="${PIN_H}" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14 1 C7.1 1 1.5 6.6 1.5 13.5 C1.5 22 14 35 14 35 C14 35 26.5 22 26.5 13.5 C26.5 6.6 20.9 1 14 1 Z"
            fill="${color}"
            stroke="#fff"
            stroke-width="2.5"
          />
        </svg>
      </div>`,
    iconSize: [PIN_W, PIN_H],
    iconAnchor: [PIN_W / 2, PIN_H],
  });
}
