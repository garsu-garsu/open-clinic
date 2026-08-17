import { Device } from "@apps-in-toss/web-framework";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { BannerAd, ImageBannerAd } from "../../components/BannerAd";
import { CoachMarks } from "../../components/CoachMarks";
import { DetailSheet } from "../../components/DetailSheet";
import { MapAppPicker } from "../../components/MapAppPicker";
import { MapView } from "../../components/MapView";
import { Card } from "../../components/ScreenLayout";
import { useAdGate } from "../../hooks/useAdGate";
import { EVENT, track, trackScreen } from "../../lib/analytics";
import { AD_GROUP_ID_BANNER } from "../../lib/env";
import { formatDistance, type LatLng } from "../../lib/geo";
import {
  directionsUrl,
  forgetMapApp,
  mapAppName,
  rememberMapApp,
  savedMapApp,
  type MapAppId,
} from "../../lib/mapApps";
import {
  filterPlaces,
  findNearby,
  RADIUS_OPTIONS,
  telUrl,
  type Kind,
  type Place,
  type Radius,
} from "../../lib/places";
import { noteGoodExperience } from "../../lib/review";
import { todayLabel } from "../../lib/schedule";
import { sharePlace } from "../../lib/share";
import { palette, stateStyle } from "../../theme";

type Phase =
  | { k: "locating" }
  | { k: "ready"; me: LatLng; all: Place[] }
  | { k: "denied" }
  | { k: "error"; message: string };

type Tab = "map" | "list";

// 10km 반경 잠금 해제 상태. 광고 시청 후 24시간 동안 광고 없이 유지돼요.
const WIDE_KEY = "oc:wide-until";
const WIDE_MS = 24 * 60 * 60 * 1000;

function isWideOpen(): boolean {
  const until = Number(localStorage.getItem(WIDE_KEY) ?? "0");
  return Date.now() < until;
}

/**
 * 주요 기능 딥링크로 들어오면 그 탭/구분부터 엽니다 — intoss://{앱}/list, /pharmacy.
 * 경로 끝 조각과 ?screen= 둘 다 보고, 모르는 값이면 평소대로 기본값.
 * (로또 알림이 쓰는 방식과 같아요.) tab 과 kind 는 서로 독립적으로 읽어요.
 */
function deepLinkScreen(): string | null {
  try {
    const { pathname, search } = window.location;
    return new URLSearchParams(search).get("screen") ?? pathname.split("/").filter(Boolean).pop() ?? null;
  } catch {
    return null;
  }
}

function initialTab(): Tab {
  const screen = deepLinkScreen();
  return screen === "list" || screen === "map" ? screen : "map";
}

function initialKind(): Kind {
  return deepLinkScreen() === "pharmacy" ? 1 : 0;
}

export function HomeScreen() {
  const [phase, setPhase] = useState<Phase>({ k: "locating" });
  const [tab, setTab] = useState<Tab>(initialTab);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [radius, setRadius] = useState<Radius>(3000);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [wideOpen, setWideOpen] = useState(isWideOpen);
  const adGate = useAdGate();
  const [picked, setPicked] = useState<Place | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // 다시 찾기 실패 안내. 목록은 그대로 두고 이 문구만 잠깐 보여줘요.
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  // 어느 지도로 안내할지. null이면 아직 안 골랐다는 뜻이라 길찾기 때 물어봐요.
  const [mapApp, setMapApp] = useState<MapAppId | null>(() => savedMapApp());
  /** 지도를 고르는 동안 어디로 갈 참이었는지 들고 있어요. */
  const [pendingGo, setPendingGo] = useState<Place | null>(null);
  /** 전화·길찾기로 앱을 떠났는지. 돌아왔을 때 리뷰를 물어볼 판단에 써요. */
  const leftForPlaceRef = useRef(false);

  // 전화나 길찾기까지 하고 돌아온 순간 = 이 앱이 제 일을 한 순간.
  // 리뷰는 그때만 물어봐요. 진입 직후에 뜨는 창은 심사 반려 사유입니다.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && leftForPlaceRef.current) {
        leftForPlaceRef.current = false;
        noteGoodExperience();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // 코치마크가 가리킬 요소들.
  const kindRef = useRef<HTMLDivElement>(null);
  const openNowRef = useRef<HTMLDivElement>(null);
  const radiusRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const locate = useCallback(async () => {
    setPhase({ k: "locating" });
    try {
      const loc = await Device.getLocation({ accuracy: 3 });
      const me = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      track(EVENT.locationGranted);
      // 가장 가까운 시군구부터 순서대로 도착해요. 그때마다 화면을 바로 갱신해서
      // 나머지 구를 기다리는 동안 빈 화면을 보여주지 않아요.
      const all = await findNearby(me, false, (partial) => setPhase({ k: "ready", me, all: partial }));
      track(EVENT.nearbyFound, { count: all.length });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name.includes("Permission")) {
        track(EVENT.locationDenied);
        setPhase({ k: "denied" });
        return;
      }
      setPhase({ k: "error", message: "위치를 확인하지 못했어요. 다시 눌러주세요." });
    }
  }, []);

  useEffect(() => {
    trackScreen("home");
    void locate();
  }, [locate]);

  /**
   * 이동 중에 위치가 바뀌었을 때 쓰는 "다시 찾기". locate() 와 달리 화면을
   * 통째로 안 갈아요 — 실패해도 갖고 있던 목록을 그대로 두고 안내만 띄웁니다.
   * 탭·반경·병원/약국·정렬 선택은 별개 state 라 건드리지 않아도 그대로 유지돼요.
   */
  const refresh = useCallback(async () => {
    if (refreshing) return; // 연타 방지
    track(EVENT.refreshTapped);
    setRefreshing(true);
    setRefreshNote(null);
    try {
      const loc = await Device.getLocation({ accuracy: 3 });
      const me = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      // findNearby 가 시군구·날짜 캐시를 그대로 써요. 같은 시군구 안에서
      // 움직였으면 새로 안 받고, 다른 시군구로 넘어갔을 때만 새로 받아옵니다.
      // 거리·진료중 여부는 findNearby 안에서 항상 지금 시각 기준으로 새로 계산돼요.
      const all = await findNearby(me, false, (partial) => setPhase({ k: "ready", me, all: partial }));
      track(EVENT.nearbyFound, { count: all.length });
    } catch {
      setRefreshNote("위치를 다시 확인하지 못했어요.");
      setTimeout(() => setRefreshNote(null), 3000);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  // 1km·3km 는 바로 적용. 10km 는 잠겨 있으면 광고를 다 봐야 열리고, 그 뒤 24시간은 바로 열려요.
  const selectRadius = useCallback(
    (r: Radius) => {
      if (r !== 10000 || wideOpen) {
        setRadius(r);
        return;
      }
      adGate.watchThen(() => {
        localStorage.setItem(WIDE_KEY, String(Date.now() + WIDE_MS));
        setWideOpen(true);
        setRadius(10000);
      }, "radius_10km");
    },
    [wideOpen, adGate],
  );

  const list = useMemo(
    () => (phase.k === "ready" ? filterPlaces(phase.all, kind, radius, onlyOpen) : []),
    [phase, kind, radius, onlyOpen],
  );

  useEffect(() => {
    if (picked != null && !list.includes(picked)) setPicked(null);
  }, [list, picked]);

  /** 고른 지도로 실제로 넘겨요. */
  const goWith = (app: MapAppId, p: Place) => {
    track(EVENT.directionsOpened, { name: p.name, app });
    leftForPlaceRef.current = true;
    void Device.openURL(directionsUrl(app, { name: p.name, lat: p.lat, lng: p.lng }));
  };

  /** 아직 지도를 안 골랐으면 고르는 창을 먼저 띄워요. */
  const go = (p: Place) => {
    if (mapApp == null) {
      setPendingGo(p);
      return;
    }
    goWith(mapApp, p);
  };

  const call = (p: Place) => {
    track(EVENT.called, { name: p.name });
    leftForPlaceRef.current = true;
    void Device.openURL(telUrl(p));
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: palette.bg,
        position: "relative",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {phase.k === "locating" && <Center><Note text="주변을 찾고 있어요…" /></Center>}

        {phase.k === "denied" && (
          <Center>
            <Note
              text="위치를 알아야 가까운 곳을 찾을 수 있어요."
              action={{ label: "위치 허용하고 찾기", onClick: () => void locate() }}
            />
          </Center>
        )}

        {phase.k === "error" && (
          <Center>
            <Note text={phase.message} action={{ label: "다시 찾기", onClick: () => void locate() }} />
          </Center>
        )}

        {phase.k === "ready" && (
          <>
            <Header
              kind={kind}
              onKind={setKind}
              radius={radius}
              onRadius={selectRadius}
              wideOpen={wideOpen}
              onlyOpen={onlyOpen}
              onOnlyOpen={setOnlyOpen}
              count={list.length}
              refreshing={refreshing}
              refreshNote={refreshNote}
              onRefresh={() => void refresh()}
              kindRef={kindRef}
              radiusRef={radiusRef}
              openNowRef={openNowRef}
              refreshRef={refreshRef}
            />

            <CoachMarks
              storageKey="open-clinic:coach:v1"
              steps={[
                { ref: kindRef, title: "병원과 약국, 따로 볼 수 있어요", body: "탭 하나로 병원·의원과 약국을 바꿔가며 찾아보세요." },
                { ref: openNowRef, title: "지금 문 연 곳만 보기", body: "지금 진료 중인 곳만 골라서 볼 수 있어요." },
                { ref: radiusRef, title: "찾는 범위를 골라요", body: "얼마나 가까운 곳까지 찾을지 눌러서 정할 수 있어요." },
                { ref: refreshRef, title: "자리를 옮겼다면", body: "이동했으면 눌러서 지금 위치로 다시 찾아보세요." },
                { ref: tabsRef, title: "지도와 목록, 편한 걸로", body: "목록에서는 가까운 순으로 요일별 진료시간까지 볼 수 있어요." },
              ]}
            />

            {tab === "map" ? (
              <div style={{ position: "absolute", inset: `${HEADER}px 0 0`, overflow: "hidden" }}>
                <MapView me={phase.me} places={list} radius={radius} onSelect={setPicked} />
                {picked != null && (
                  <DetailSheet
                    p={picked}
                    onClose={() => setPicked(null)}
                    onGo={() => go(picked)}
                    onCall={() => call(picked)}
                    onShare={() => void sharePlace(picked)}
                  />
                )}
              </div>
            ) : (
              <ListPane
                list={list}
                onGo={go}
                onCall={call}
                kind={kind}
                mapApp={mapApp}
                onResetMapApp={() => {
                  forgetMapApp();
                  setMapApp(null);
                }}
              />
            )}

            {/* 길찾기를 눌렀을 때만 열려요. 진입 직후에 뜨는 창이 아닙니다. */}
            {pendingGo != null && (
              <MapAppPicker
                onPick={(app, remember) => {
                  if (remember) {
                    rememberMapApp(app);
                    setMapApp(app);
                  }
                  const target = pendingGo;
                  setPendingGo(null);
                  goWith(app, target);
                }}
                onClose={() => setPendingGo(null)}
              />
            )}
          </>
        )}
      </div>

      {/* --------------------------------------------------- 하단 탭 (플로팅)
          바닥에 꽉 채우면 토스 앱 자체 하단 탭과 모양이 겹쳐서, 사용자가 지금
          어디에 있는지 헷갈려요. 앱인토스 UX 가이드가 캡슐형 플로팅을 요구합니다. */}
      <nav
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          // 배너 자리가 없을 때 홈 인디케이터에 걸리지 않게 띄워요.
          bottom: "calc(12px + env(safe-area-inset-bottom))",
          display: "flex",
          justifyContent: "center",
          // 캡슐 밖은 손가락이 그대로 지도로 통과해야 해요.
          pointerEvents: "none",
          // 상세 카드(1000)보다 위에 있어야 탭이 안 가려져요.
          zIndex: 1100,
        }}
      >
        <div
          ref={tabsRef}
          style={{
            pointerEvents: "auto",
            display: "inline-flex",
            background: palette.white,
            borderRadius: 999,
            padding: 6,
            boxShadow: "0 6px 20px rgba(20,24,31,0.18)",
          }}
        >
          <TabButton active={tab === "map"} onClick={() => setTab("map")} label="지도" icon="🗺️" />
          <TabButton active={tab === "list"} onClick={() => setTab("list")} label="목록" icon="📋" />
        </div>
      </nav>

      {/* 하단 고정 배너. locating/denied/error 단계에서 먼저 뜨면 흰 블록만 화면
          아래에 남아 진입 직후 바텀시트처럼 보인다는 반려를 받았어요 — 그래서
          첫 화면(지도·목록)이 준비된 뒤(phase === "ready")에만 자리를 만듭니다.
          배너 그룹 ID가 없으면 BannerAd 가 null 을 그리니 그때도 자리를 안 만들어요. */}
      {phase.k === "ready" && AD_GROUP_ID_BANNER !== "" && (
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
      )}
    </div>
  );
}

const HEADER = 132;

/* ------------------------------------------------------------------ 조각 */

function Header({
  kind,
  onKind,
  radius,
  onRadius,
  wideOpen,
  onlyOpen,
  onOnlyOpen,
  count,
  refreshing,
  refreshNote,
  onRefresh,
  kindRef,
  radiusRef,
  openNowRef,
  refreshRef,
}: {
  kind: Kind;
  onKind: (k: Kind) => void;
  radius: Radius;
  onRadius: (r: Radius) => void;
  wideOpen: boolean;
  onlyOpen: boolean;
  onOnlyOpen: (v: boolean) => void;
  count: number;
  refreshing: boolean;
  refreshNote: string | null;
  onRefresh: () => void;
  kindRef: RefObject<HTMLDivElement>;
  radiusRef: RefObject<HTMLDivElement>;
  openNowRef: RefObject<HTMLDivElement>;
  refreshRef: RefObject<HTMLButtonElement>;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: HEADER,
        padding: "8px 16px 0",
        background: palette.bg,
        zIndex: 2,
      }}
    >
      {/* 병원 / 약국 */}
      <div ref={kindRef} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Seg active={kind === 0} onClick={() => onKind(0)} label="병원·의원" />
        <Seg active={kind === 1} onClick={() => onKind(1)} label="약국" />
      </div>

      {/* 반경 + 지금 문 연 곳만 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div ref={radiusRef} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {RADIUS_OPTIONS.map((r) => (
            <Chip
              key={r}
              active={radius === r}
              onClick={() => onRadius(r)}
              label={
                r < 1000
                  ? `${r}m`
                  : r === 10000 && !wideOpen
                    ? "10km 광고보기"
                    : `${r / 1000}km`
              }
            />
          ))}
        </div>
        <div ref={openNowRef}>
          <Chip
            active={onlyOpen}
            onClick={() => onOnlyOpen(!onlyOpen)}
            label="지금 열린 곳"
          />
        </div>
      </div>

      {/* 개수 + 다시 찾기 — 지도·목록 두 탭이 이 줄을 같이 써요. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 13, color: refreshNote != null ? palette.unknown : palette.sub }}>
          {refreshNote ?? `${count}곳`}
        </span>
        <button
          ref={refreshRef}
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 700,
            color: refreshing ? palette.sub : palette.primary,
            background: "rgba(20,24,31,0.06)",
          }}
        >
          {refreshing ? "찾는 중…" : "다시 찾기"}
        </button>
      </div>
    </div>
  );
}

function Seg({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        border: "none",
        borderRadius: 10,
        padding: "10px 0",
        fontSize: 16,
        fontWeight: 700,
        color: active ? palette.white : palette.sub,
        background: active ? palette.primary : "rgba(20,24,31,0.06)",
      }}
    >
      {label}
    </button>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: 999,
        padding: "7px 12px",
        fontSize: 13,
        fontWeight: 700,
        color: active ? palette.white : palette.sub,
        background: active ? palette.primary : "rgba(20,24,31,0.06)",
      }}
    >
      {label}
    </button>
  );
}

function ListPane({
  list,
  onGo,
  onCall,
  kind,
  mapApp,
  onResetMapApp,
}: {
  list: Place[];
  onGo: (p: Place) => void;
  onCall: (p: Place) => void;
  kind: Kind;
  mapApp: MapAppId | null;
  onResetMapApp: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: `${HEADER}px 0 0`,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "0 16px calc(96px + env(safe-area-inset-bottom))",
      }}
    >
      {list.length === 0 ? (
        <Note text={`이 조건에 맞는 ${kind === 0 ? "병원" : "약국"}이 없어요. 반경을 넓혀보세요.`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((p, i) => (
            <PlaceRow key={`${p.lat},${p.lng},${i}`} p={p} onGo={() => onGo(p)} onCall={() => onCall(p)} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <ImageBannerAd />
      </div>

      {/* 지도 앱을 기억해 둔 사람에게만 되돌리는 줄을 보여줘요.
          안드로이드 "기본으로 열기 초기화" 를 앱 안에서 하는 자리입니다. */}
      {mapApp != null && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 13,
            color: palette.sub,
          }}
        >
          <span>
            길찾기는 <b style={{ color: palette.ink }}>{mapAppName(mapApp)}</b>로 열려요
          </span>
          <button
            type="button"
            onClick={onResetMapApp}
            style={{
              flexShrink: 0,
              border: "none",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 700,
              color: palette.primary,
              background: "rgba(22,104,184,0.10)",
            }}
          >
            다시 고르기
          </button>
        </div>
      )}

      <p style={{ fontSize: 12, color: palette.sub, marginTop: 16, lineHeight: 1.6 }}>
        보건복지부 응급의료정보원 제공 진료시간 기준이에요. 방문 전 전화로 꼭 확인하세요.
        이 앱은 병원을 추천하거나 평가하지 않아요.
      </p>
    </div>
  );
}

function PlaceRow({ p, onGo, onCall }: { p: Place; onGo: () => void; onCall: () => void }) {
  const s = stateStyle(p.state);
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {/* 색만으로 구분하지 않아요. */}
        <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</span>
        <span style={{ fontSize: 13, color: palette.sub }}>· {todayLabel(p.week)}</span>
      </div>

      <div style={{ fontSize: 17, fontWeight: 700, color: palette.ink }}>{p.name}</div>
      <div style={{ fontSize: 14, color: palette.sub, marginTop: 2 }}>
        {formatDistance(p.distance)}
        {p.dept !== "" && ` · ${p.dept}`}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {p.tel !== "" && (
          <button onClick={onCall} style={btn(palette.white, palette.primary, true)}>
            전화
          </button>
        )}
        <button onClick={onGo} style={btn(palette.primary, palette.white, false)}>
          길찾기
        </button>
      </div>
    </Card>
  );
}

function btn(bg: string, fg: string, outlined: boolean): React.CSSProperties {
  return {
    flex: 1,
    border: outlined ? `1.5px solid ${fg}` : "none",
    borderRadius: 12,
    padding: "12px 0",
    fontSize: 15,
    fontWeight: 700,
    color: fg,
    background: bg,
  };
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        background: "transparent",
        borderRadius: 999,
        padding: "8px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1.1, opacity: active ? 1 : 0.4 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: active ? palette.ink : palette.sub }}>
        {label}
      </span>
    </button>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 20 }}>
      {children}
    </div>
  );
}

function Note({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <Card style={{ textAlign: "center", padding: 24 }}>
      <p style={{ fontSize: 15, color: palette.sub, margin: 0, lineHeight: 1.6 }}>{text}</p>
      {action != null && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 16,
            border: "none",
            borderRadius: 12,
            padding: "14px 20px",
            fontSize: 16,
            fontWeight: 700,
            color: palette.white,
            background: palette.primary,
          }}
        >
          {action.label}
        </button>
      )}
    </Card>
  );
}
