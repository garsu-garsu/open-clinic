import { Device } from "@apps-in-toss/web-framework";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ImageBannerAd } from "../../components/BannerAd";
import { DetailSheet } from "../../components/DetailSheet";
import { MapView } from "../../components/MapView";
import { Card } from "../../components/ScreenLayout";
import { EVENT, track, trackScreen } from "../../lib/analytics";
import { formatDistance, type LatLng } from "../../lib/geo";
import {
  directionsUrl,
  filterPlaces,
  findNearby,
  RADIUS_OPTIONS,
  telUrl,
  type Kind,
  type Place,
  type Radius,
} from "../../lib/places";
import { todayLabel } from "../../lib/schedule";
import { palette, stateStyle } from "../../theme";

type Phase =
  | { k: "locating" }
  | { k: "ready"; me: LatLng; all: Place[] }
  | { k: "denied" }
  | { k: "error"; message: string };

type Tab = "map" | "list";

export function HomeScreen() {
  const [phase, setPhase] = useState<Phase>({ k: "locating" });
  const [tab, setTab] = useState<Tab>("list");
  const [kind, setKind] = useState<Kind>(0);
  const [radius, setRadius] = useState<Radius>(3000);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [picked, setPicked] = useState<Place | null>(null);

  const locate = useCallback(async () => {
    setPhase({ k: "locating" });
    try {
      const loc = await Device.getLocation({ accuracy: 3 });
      const me = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      track(EVENT.locationGranted);
      const all = await findNearby(me);
      track(EVENT.nearbyFound, { count: all.length });
      setPhase({ k: "ready", me, all });
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

  const list = useMemo(
    () => (phase.k === "ready" ? filterPlaces(phase.all, kind, radius, onlyOpen) : []),
    [phase, kind, radius, onlyOpen],
  );

  useEffect(() => {
    if (picked != null && !list.includes(picked)) setPicked(null);
  }, [list, picked]);

  const go = (p: Place) => {
    track(EVENT.directionsOpened, { name: p.name });
    void Device.openURL(directionsUrl(p));
  };
  const call = (p: Place) => {
    track(EVENT.called, { name: p.name });
    void Device.openURL(telUrl(p));
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: palette.bg }}>
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
              onRadius={setRadius}
              onlyOpen={onlyOpen}
              onOnlyOpen={setOnlyOpen}
              count={list.length}
            />

            {tab === "map" ? (
              <div style={{ position: "absolute", inset: `${HEADER}px 0 0`, overflow: "hidden" }}>
                <MapView me={phase.me} toilets={list} radius={radius} onSelect={setPicked} />
                {picked != null && (
                  <DetailSheet
                    p={picked}
                    onClose={() => setPicked(null)}
                    onGo={() => go(picked)}
                    onCall={() => call(picked)}
                  />
                )}
              </div>
            ) : (
              <ListPane list={list} onGo={go} onCall={call} kind={kind} />
            )}
          </>
        )}
      </div>

      <nav
        style={{
          flexShrink: 0,
          display: "flex",
          borderTop: "1px solid rgba(20,24,31,0.08)",
          background: palette.white,
        }}
      >
        <TabButton active={tab === "list"} onClick={() => setTab("list")} label="목록" />
        <TabButton active={tab === "map"} onClick={() => setTab("map")} label="지도" />
      </nav>
    </div>
  );
}

const HEADER = 100;

/* ------------------------------------------------------------------ 조각 */

function Header({
  kind,
  onKind,
  radius,
  onRadius,
  onlyOpen,
  onOnlyOpen,
  count,
}: {
  kind: Kind;
  onKind: (k: Kind) => void;
  radius: Radius;
  onRadius: (r: Radius) => void;
  onlyOpen: boolean;
  onOnlyOpen: (v: boolean) => void;
  count: number;
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
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Seg active={kind === 0} onClick={() => onKind(0)} label="병원·의원" />
        <Seg active={kind === 1} onClick={() => onKind(1)} label="약국" />
      </div>

      {/* 반경 + 지금 문 연 곳만 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {RADIUS_OPTIONS.map((r) => (
          <Chip
            key={r}
            active={radius === r}
            onClick={() => onRadius(r)}
            label={r < 1000 ? `${r}m` : `${r / 1000}km`}
          />
        ))}
        <Chip
          active={onlyOpen}
          onClick={() => onOnlyOpen(!onlyOpen)}
          label="지금 열린 곳"
        />
        <span style={{ marginLeft: "auto", fontSize: 13, color: palette.sub }}>{count}곳</span>
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
}: {
  list: Place[];
  onGo: (p: Place) => void;
  onCall: (p: Place) => void;
  kind: Kind;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: `${HEADER}px 0 0`,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "0 16px 24px",
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

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        border: "none",
        background: "transparent",
        padding: "14px 0",
        fontSize: 16,
        fontWeight: 700,
        color: active ? palette.primary : palette.sub,
        borderTop: `3px solid ${active ? palette.primary : "transparent"}`,
        marginTop: -1,
      }}
    >
      {label}
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
