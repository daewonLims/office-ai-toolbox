/** 규칙 공용 순수 헬퍼 */
import { GRAYSCALE_TOLERANCE } from "../constants";

/** 회색 계열(검정/흰색/회색 포함) 여부 — 팔레트 검사에서 허용 예외 */
export function isGrayscale(hex: string): boolean {
  const m = /^([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/.exec(hex.toUpperCase());
  if (!m) return false;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min <= GRAYSCALE_TOLERANCE;
}

/** 빈도 맵에서 최빈값(동률이면 먼저 등장/큰 count 우선)을 반환 */
export function mode<T>(counts: Map<T, number>): T | null {
  let best: T | null = null;
  let bestCount = -1;
  for (const [k, c] of counts) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
}

/** 숫자 배열의 중앙값 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
