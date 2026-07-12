/**
 * 결정적(deterministic) 값 정규화 함수 — 클라이언트에서 실행.
 *
 * LLM은 "어떤 변환이 필요한지"(transformKind, 원본 날짜 형식)만 판단하고,
 * 실제 값 변환은 이 화이트리스트된 함수들만 수행합니다.
 * LLM 출력 문자열을 코드로 실행하지 않습니다.
 */
import type { CellValue } from "./types";

/** 서버/클라이언트 공용으로 허용되는 날짜 원본 형식 토큰 */
export const DATE_FORMAT_TOKENS = [
  "YYYY-MM-DD",
  "YYYY/MM/DD",
  "YYYY.MM.DD",
  "MM-DD-YYYY",
  "MM/DD/YYYY",
  "DD-MM-YYYY",
  "DD/MM/YYYY",
  "YYYYMMDD",
] as const;

export type DateFormatToken = (typeof DATE_FORMAT_TOKENS)[number];

const DATE_FORMAT_SET: ReadonlySet<string> = new Set(DATE_FORMAT_TOKENS);

/** 허용 토큰인지 확인 (서버측 보정에서도 재사용) */
export function isKnownDateFormat(token: string | null | undefined): token is DateFormatToken {
  return typeof token === "string" && DATE_FORMAT_SET.has(token);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** y/m/d 숫자가 실제 존재하는 날짜인지 검증 (월별 일수 포함) */
function isValidYmd(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1000 || y > 9999) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

function buildIso(y: number, m: number, d: number): string | null {
  if (!isValidYmd(y, m, d)) return null;
  return `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
}

/** UTC 구성요소로 YYYY-MM-DD 포맷 (타임존 off-by-one 방지) */
function fmtUtc(date: Date): string | null {
  if (isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Excel 시리얼 숫자(1899-12-30 기준)를 Date로. 1900 윤년 버그 오프셋 반영. */
function excelSerialToDate(serial: number): Date | null {
  if (!isFinite(serial)) return null;
  const ms = Math.round(serial * 86400000);
  const date = new Date(Date.UTC(1899, 11, 30) + ms);
  if (isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  if (y < 1900 || y > 9999) return null;
  return date;
}

/** 명시된 형식 토큰에 따라 문자열 파싱 (구분자는 관대하게 처리) */
function parseWithFormat(s: string, fmt: DateFormatToken): string | null {
  if (fmt === "YYYYMMDD") {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
    if (!m) return null;
    return buildIso(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  const nums = s.split(/\D+/).filter(Boolean);
  if (nums.length !== 3) return null;
  const tokens = fmt.split(/[-/.]/);
  let y: number | null = null;
  let mo: number | null = null;
  let d: number | null = null;
  for (let i = 0; i < 3; i++) {
    const t = tokens[i];
    const v = Number(nums[i]);
    if (t.startsWith("Y")) y = v;
    else if (t.startsWith("M")) mo = v;
    else if (t.startsWith("D")) d = v;
  }
  if (y === null || mo === null || d === null) return null;
  return buildIso(y, mo, d);
}

/** 형식 토큰이 없을 때의 휴리스틱 파싱 (값이 12를 넘는 위치로 모호성 해소) */
function parseHeuristic(s: string): string | null {
  // YYYY 선두: YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return buildIso(Number(m[1]), Number(m[2]), Number(m[3]));

  // YYYYMMDD (8자리)
  m = /^(\d{8})$/.exec(s);
  if (m) return buildIso(Number(m[1].slice(0, 4)), Number(m[1].slice(4, 6)), Number(m[1].slice(6, 8)));

  // XX-XX-YYYY : MM-DD-YYYY vs DD-MM-YYYY 모호 → 12 초과 위치로 판별
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    if (a > 12 && b <= 12) return buildIso(y, b, a); // a=일 → DD-MM-YYYY
    if (b > 12 && a <= 12) return buildIso(y, a, b); // b=일 → MM-DD-YYYY
    // 둘 다 12 이하로 모호하면 MM-DD-YYYY(미국식)로 기본 처리
    return buildIso(y, a, b);
  }
  return null;
}

/**
 * 다양한 입력을 YYYY-MM-DD로 정규화합니다.
 * - 문자열 / Date / 엑셀 시리얼 숫자 입력 허용
 * - sourceFormat 토큰이 있으면 그에 따라 파싱(MM-DD-YYYY vs DD-MM-YYYY 모호성 해소)
 * - 없으면 휴리스틱
 * - 파싱 실패 시 원본 값을 유지(문자열화하여 반환), 빈값/null은 null
 * - 이미 목표 형식(YYYY-MM-DD)이면 멱등
 */
export function normalizeDate(
  value: CellValue | Date | undefined,
  sourceFormat?: string | null
): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return fmtUtc(value) ?? null;
  }

  if (typeof value === "number") {
    const date = excelSerialToDate(value);
    const iso = date ? fmtUtc(date) : null;
    return iso ?? String(value);
  }

  const s = String(value).trim();
  if (s === "") return null;

  if (isKnownDateFormat(sourceFormat)) {
    const byFormat = parseWithFormat(s, sourceFormat);
    if (byFormat) return byFormat;
  }

  const byHeuristic = parseHeuristic(s);
  return byHeuristic ?? s; // 실패 시 원본 유지
}

/**
 * 한국 전화번호 포맷 정규화. 숫자만 추출 후 규칙에 맞으면 하이픈 삽입.
 * 자리수가 규칙에 안 맞으면 원본을 그대로 반환합니다.
 */
export function normalizePhone(value: CellValue | undefined): string {
  if (value === null || value === undefined) return "";
  const orig = String(value).trim();
  const digits = orig.replace(/\D/g, "");
  if (digits === "") return orig;

  // 휴대폰: 010/011/016/017/018/019
  if (/^01\d/.test(digits)) {
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return orig;
  }

  // 서울 02
  if (digits.startsWith("02")) {
    if (digits.length === 10) return `02-${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 9) return `02-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return orig;
  }

  // 그 외 지역번호 (0XX, 3자리)
  if (/^0\d{2}/.test(digits)) {
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return orig;
  }

  return orig;
}
