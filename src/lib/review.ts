/**
 * 리뷰 요청.
 *
 * 규칙 하나: **좋은 경험 뒤에만.** 이 앱에서 좋은 경험은 "문 연 곳을 찾아서
 * 전화나 길찾기까지 하고 앱으로 돌아온 것" 이에요. 진입 직후나 실패 직후에 띄우면
 * 별점이 낮게 깔리고, 심사에서도 진입 즉시 뜨는 창은 반려 사유예요.
 *
 * 토스가 자체 피로도 정책으로 실제 노출을 걸러주지만(막혀도 정상 resolve),
 * 그걸 믿고 매번 부르면 안 돼요. 여기서도 세 겹으로 막아요.
 *   1. 좋은 경험을 2번 이상 한 사람에게만
 *   2. 한 번 물어봤으면 90일 동안 다시 안 물어봄
 *   3. 같은 세션에서는 한 번만
 */
import { Review } from "@apps-in-toss/web-framework";

const KEY = "open-clinic:review:v1";
const WINS_NEEDED = 2;
const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

export interface ReviewState {
  /** 좋은 경험 누적 횟수. */
  wins: number;
  /** 마지막으로 물어본 시각(ms). 아직 안 물어봤으면 null. */
  askedAt: number | null;
}

const EMPTY: ReviewState = { wins: 0, askedAt: null };

/** 순수 판정 — localStorage 없이 테스트해요. */
export function shouldAsk(state: ReviewState, now: number): boolean {
  if (state.wins < WINS_NEEDED) return false;
  if (state.askedAt == null) return true;
  return now - state.askedAt >= COOLDOWN_MS;
}

function load(): ReviewState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return EMPTY;
    const p = JSON.parse(raw) as Partial<ReviewState>;
    return {
      wins: typeof p.wins === "number" ? p.wins : 0,
      askedAt: typeof p.askedAt === "number" ? p.askedAt : null,
    };
  } catch {
    return EMPTY;
  }
}

function save(state: ReviewState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 저장이 막히면 이번 세션만 못 세는 것뿐이에요. */
  }
}

/** 이 세션에서 이미 물어봤는지. 새로고침하면 초기화돼요. */
let askedThisSession = false;

/**
 * 좋은 경험이 끝난 지점에서 부르세요. 조건이 되면 그 자리에서 리뷰 창을 띄워요.
 * 미지원 버전·브라우저에서는 조용히 넘어가요.
 */
export function noteGoodExperience(): void {
  const state = { ...load(), wins: load().wins + 1 };
  const now = Date.now();

  if (askedThisSession || !shouldAsk(state, now)) {
    save(state);
    return;
  }

  askedThisSession = true;
  save({ ...state, askedAt: now });

  void (async () => {
    try {
      if (!Review.request.isSupported()) return;
      await Review.request();
    } catch (err) {
      console.error("리뷰 요청 실패:", err);
    }
  })();
}

/* ------------------------------------------------------------------ */
/* 자체 점검 — `npm run check:growth`                                   */
/* ------------------------------------------------------------------ */
export function demo(): void {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.parse("2026-08-17T00:00:00Z");
  const eq = (got: unknown, want: unknown, label: string) => {
    if (got !== want) throw new Error(`${label}: ${String(got)} !== ${String(want)}`);
  };

  eq(shouldAsk({ wins: 0, askedAt: null }, now), false, "처음 온 사람에겐 안 물어봄");
  eq(shouldAsk({ wins: 1, askedAt: null }, now), false, "한 번 써본 사람에게도 안 물어봄");
  eq(shouldAsk({ wins: 2, askedAt: null }, now), true, "두 번 잘 쓰면 물어봄");
  eq(shouldAsk({ wins: 9, askedAt: now - 10 * day }, now), false, "물어본 뒤 10일은 안 물어봄");
  eq(shouldAsk({ wins: 9, askedAt: now - 91 * day }, now), true, "91일 뒤엔 다시 물어봄");

  console.log("review.ts OK");
}
