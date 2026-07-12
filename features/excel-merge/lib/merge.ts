/**
 * 확정된 매핑에 따라 시트들을 취합 (클라이언트 측 — server-only 아님).
 * LLM transform 문자열(note)은 절대 코드로 실행하지 않음 (표시 전용).
 * 실제 값 변환은 normalize.ts 의 화이트리스트 함수만 수행.
 */
import type { CellValue, ParsedSheet } from "./types";
import type { TransformKind } from "./mapping-schema";
import { normalizeDate, normalizePhone } from "./normalize";

/** 기준 targetColumn 하나에 대한 이 파일의 매핑 정보 */
export interface ConfirmedColumnMapping {
  /** 이 파일의 소스 컬럼 헤더 (null = 매핑 안 함) */
  sourceColumn: string | null;
  transformKind: TransformKind;
  dateSourceFormat: string | null;
}

export interface ConfirmedFileMapping {
  fileName: string;
  excluded: boolean;
  columnMap: Record<string, ConfirmedColumnMapping>;
}

export interface MergeOptions {
  /** 기준 targetColumn -> { 원본값 -> 통일값 } (옵트인 값 통일 적용분) */
  valueUnification?: Record<string, Record<string, string>>;
}

export interface MergeOutput {
  headers: string[]; // base.headers + "출처 파일"
  rows: CellValue[][];
  fileCount: number; // 포함된 파일 수 (base + 제외되지 않은 소스)
  rowCount: number; // 취합된 총 데이터 행 수
}

const SOURCE_COLUMN = "출처 파일";

function pad2(n: string): string {
  return n.length >= 2 ? n : "0".repeat(2 - n.length) + n;
}

/** ISO(YYYY-MM-DD...) / YYYY/MM/DD / YYYY.MM.DD 를 YYYY-MM-DD 로 재포맷 */
function reformatDate(s: string): string | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  return null;
}

/** transformKind 가 없는(none/other) 일반 셀의 결정론적 정규화 */
function normalizeCell(v: CellValue): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (s === "") return null;
  return reformatDate(s) ?? s;
}

/** transformKind 에 따라 셀 값 변환 */
function transformCell(
  raw: CellValue,
  kind: TransformKind,
  dateSourceFormat: string | null
): CellValue {
  if (kind === "date") {
    // normalizeDate 는 멱등 — 이미 목표 형식이어도 안전. 실패 시 원본 유지.
    return normalizeDate(raw, dateSourceFormat);
  }
  if (kind === "phone") {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (s === "") return null;
    return normalizePhone(s);
  }
  return normalizeCell(raw);
}

/** 옵트인 값 통일 치환 (문자열 값에만 적용) */
function applyUnification(v: CellValue, map: Record<string, string> | undefined): CellValue {
  if (!map || typeof v !== "string") return v;
  const to = map[v];
  return to === undefined ? v : to;
}

export function mergeSheets(
  base: ParsedSheet,
  sources: ParsedSheet[],
  mappings: ConfirmedFileMapping[],
  options: MergeOptions = {}
): MergeOutput {
  const headers = [...base.headers, SOURCE_COLUMN];
  const rows: CellValue[][] = [];
  let fileCount = 0;

  const unify = options.valueUnification ?? {};

  // 기준 컬럼별 대표 transformKind 집계:
  // 소스 매핑 중 하나라도 date/phone 이면 기준 파일 컬럼에도 동일 정규화를 적용.
  const targetTransform = new Map<string, { kind: TransformKind; dateSourceFormat: string | null }>();
  for (const cm of mappings) {
    if (cm.excluded) continue;
    for (const [target, col] of Object.entries(cm.columnMap)) {
      if (col.transformKind === "date" || col.transformKind === "phone") {
        if (!targetTransform.has(target)) {
          targetTransform.set(target, {
            kind: col.transformKind,
            dateSourceFormat: col.dateSourceFormat,
          });
        }
      }
    }
  }

  // 기준 파일: 항상 포함, 항등 매핑 (단, 값 정규화는 거침)
  fileCount++;
  for (const r of base.rows) {
    const out: CellValue[] = base.headers.map((baseHeader, i) => {
      const t = targetTransform.get(baseHeader);
      // 기준 파일 자체 형식은 알 수 없으므로 dateSourceFormat 없이(휴리스틱) 정규화 — 멱등.
      const value = t
        ? transformCell(r[i] ?? null, t.kind, null)
        : normalizeCell(r[i] ?? null);
      return applyUnification(value, unify[baseHeader]);
    });
    out.push(base.fileName);
    rows.push(out);
  }

  // 소스 파일들
  for (const src of sources) {
    const cm = mappings.find((m) => m.fileName === src.fileName);
    if (!cm || cm.excluded) continue;
    fileCount++;

    const headerIndex = new Map<string, number>();
    src.headers.forEach((h, i) => {
      if (!headerIndex.has(h)) headerIndex.set(h, i);
    });

    for (const r of src.rows) {
      const out: CellValue[] = base.headers.map((baseHeader) => {
        const col = cm.columnMap[baseHeader];
        const srcHeader = col?.sourceColumn ?? null;
        if (srcHeader == null) return null;
        const ci = headerIndex.get(srcHeader);
        if (ci === undefined) return null;
        const raw = r[ci] ?? null;
        const value = col
          ? transformCell(raw, col.transformKind, col.dateSourceFormat)
          : normalizeCell(raw);
        return applyUnification(value, unify[baseHeader]);
      });
      out.push(src.fileName);
      rows.push(out);
    }
  }

  return { headers, rows, fileCount, rowCount: rows.length };
}
