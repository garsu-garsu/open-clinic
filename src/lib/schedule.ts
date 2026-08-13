/**
 * "지금 문 열었나" 판정.
 *
 * 심평원·응급의료정보원 데이터는 요일별 진료 시작/종료 시각을 줘요.
 * 빌드 스크립트가 아래 형식으로 줄여 놓고, 앱은 줄여진 값만 봅니다.
 *
 *   "0900-1800"  그 요일 진료
 *   ""           그 요일 휴무
 *
 * 8칸짜리 배열이고 순서는 [월,화,수,목,금,토,일,공휴일] 이에요.
 * 원본(dutyTime1s ~ dutyTime8s)의 순서를 그대로 따릅니다.
 */
export type Week = string[]; // 길이 8

export type OpenState = "open" | "closed" | "unknown";

/** Date.getDay()(일=0) → 우리 배열 인덱스(월=0). */
export function slotOf(day: number): number {
  return (day + 6) % 7;
}

function toMinutes(hhmm: string): number | null {
  if (!/^\d{4}$/.test(hhmm)) return null;
  const h = Number(hhmm.slice(0, 2));
  const m = Number(hhmm.slice(2));
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/**
 * 지금 진료 중인가요?
 * @param week 8칸 시간표
 * @param now  기준 시각. 안 주면 현재.
 * @param holiday 오늘이 공휴일이면 true — 8번째 칸을 봅니다.
 */
export function openState(week: Week, now?: Date, holiday = false): OpenState {
  const d = now ?? new Date();
  const idx = holiday ? 7 : slotOf(d.getDay());
  const span = week[idx];

  // 시간표 자체가 비어 있는 기관이 꽤 있어요. "휴무"와 "정보 없음"은 달라요.
  if (span == null) return "unknown";
  if (span === "") return "closed";

  const [rawStart, rawEnd] = span.split("-");
  const start = toMinutes(rawStart ?? "");
  const end = toMinutes(rawEnd ?? "");
  if (start == null || end == null) return "unknown";

  const nowMin = d.getHours() * 60 + d.getMinutes();
  // 24시 약국처럼 자정을 넘기는 경우.
  if (end <= start) return nowMin >= start || nowMin < end ? "open" : "closed";
  return nowMin >= start && nowMin < end ? "open" : "closed";
}

/** 오늘 진료시간 라벨. */
export function todayLabel(week: Week, now?: Date, holiday = false): string {
  const d = now ?? new Date();
  const span = week[holiday ? 7 : slotOf(d.getDay())];
  if (span == null || span === "") return span === "" ? "오늘 휴무" : "진료시간 정보 없음";
  const fmt = (v: string) => `${v.slice(0, 2)}:${v.slice(2)}`;
  const [s, e] = span.split("-");
  return `오늘 ${fmt(s)}~${fmt(e)}`;
}

/** 시간표 전체를 사람 말로. 상세 화면에서 씁니다. */
export const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일", "공휴일"];

export function weekLines(week: Week): { day: string; span: string }[] {
  return DAY_NAMES.map((day, i) => {
    const v = week[i];
    if (v == null) return { day, span: "정보 없음" };
    if (v === "") return { day, span: "휴무" };
    const fmt = (s: string) => `${s.slice(0, 2)}:${s.slice(2)}`;
    const [a, b] = v.split("-");
    return { day, span: `${fmt(a)}~${fmt(b)}` };
  });
}

/* ------------------------------------------------------------------ */
/* 자체 점검 — `npm run check:schedule`                                */
/* 여기가 틀리면 "열었대서 갔는데 닫힌" 최악이 나요.                   */
/* ------------------------------------------------------------------ */
export function demo(): void {
  const eq = (got: unknown, want: unknown, label: string) => {
    if (got !== want) throw new Error(`${label}: ${String(got)} !== ${String(want)}`);
  };
  const at = (iso: string) => new Date(iso);

  // 2026-08-14 는 금요일.
  eq(at("2026-08-14T10:00:00").getDay(), 5, "기준일이 금요일인지 확인");
  eq(slotOf(5), 4, "금요일은 5번째 칸(인덱스 4)");
  eq(slotOf(0), 6, "일요일은 마지막 칸(인덱스 6)");
  eq(slotOf(1), 0, "월요일은 첫 칸");

  const clinic: Week = [
    "0900-1800", "0900-1800", "0900-1800", "0900-1800", "0900-1800",
    "0900-1300", "", "",
  ];

  eq(openState(clinic, at("2026-08-14T10:00:00")), "open", "금요일 오전은 진료");
  eq(openState(clinic, at("2026-08-14T18:00:00")), "closed", "18시 정각은 끝");
  eq(openState(clinic, at("2026-08-14T08:59:00")), "closed", "9시 전은 닫힘");
  eq(openState(clinic, at("2026-08-15T14:00:00")), "closed", "토요일 오후는 닫힘");
  eq(openState(clinic, at("2026-08-16T10:00:00")), "closed", "일요일은 휴무");
  eq(openState(clinic, at("2026-08-14T10:00:00"), true), "closed", "공휴일이면 8번째 칸");

  // 24시 약국 — 자정을 넘기는 구간
  const night: Week = Array(8).fill("0900-0300");
  eq(openState(night, at("2026-08-14T23:00:00")), "open", "밤 11시 열림");
  eq(openState(night, at("2026-08-14T02:00:00")), "open", "새벽 2시 열림");
  eq(openState(night, at("2026-08-14T05:00:00")), "closed", "새벽 5시 닫힘");

  // 시간표가 비어 있는 기관 — "휴무"로 단정하면 안 돼요.
  const blank: Week = Array(8).fill(undefined) as unknown as Week;
  eq(openState(blank, at("2026-08-14T10:00:00")), "unknown", "정보 없으면 모름");
  const broken: Week = Array(8).fill("9-18");
  eq(openState(broken, at("2026-08-14T10:00:00")), "unknown", "형식 깨지면 모름");

  eq(todayLabel(clinic, at("2026-08-14T10:00:00")), "오늘 09:00~18:00", "오늘 라벨");
  eq(todayLabel(clinic, at("2026-08-16T10:00:00")), "오늘 휴무", "휴무 라벨");
  eq(weekLines(clinic)[6].span, "휴무", "주간표 일요일");
  eq(weekLines(clinic)[0].span, "09:00~18:00", "주간표 월요일");

  console.log("schedule.ts OK");
}
