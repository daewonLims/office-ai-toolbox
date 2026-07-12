/**
 * 엑셀 워크북 파싱 (클라이언트 측 — server-only 아님).
 * ExcelJS는 항상 동적 import (브라우저 webpack + 순수 Node 모두 동작하는 방어 패턴).
 */
import type { CellValue, ParsedSheet } from "./types";
import { MAX_CELL_LEN, MAX_SAMPLE_ROWS, type FileMeta } from "./mapping-schema";

function emptyErr(fileName: string): Error {
  return new Error(`빈 시트이거나 데이터를 읽을 수 없습니다: ${fileName}`);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Excel 날짜 셀은 UTC 자정으로 저장되므로 UTC 구성요소로 포맷 (타임존 off-by-one 방지) */
function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** ExcelJS 셀 객체(수식/리치텍스트/하이퍼링크/오류)에서 표시 텍스트/원시값 추출 */
function objectDisplay(v: any): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v !== "object") return v;
  if (Array.isArray(v.richText)) {
    return v.richText.map((r: any) => (r && r.text != null ? String(r.text) : "")).join("");
  }
  if ("result" in v) return v.result; // 수식 { formula, result }
  if ("text" in v) return v.text; // 하이퍼링크 { text, hyperlink }
  if ("hyperlink" in v) return v.hyperlink;
  if ("error" in v) return String(v.error);
  return "";
}

/** 셀 값을 타입 유지 CellValue로 정규화 (number 유지, Date→YYYY-MM-DD, 빈값→null) */
function typedCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return fmtDate(value);
  const t = typeof value;
  if (t === "number") return value as number;
  if (t === "boolean") return (value as boolean) ? "TRUE" : "FALSE";
  if (t === "string") {
    const s = (value as string).trim();
    return s === "" ? null : s;
  }
  const disp = objectDisplay(value);
  if (disp === null || disp === undefined) return null;
  if (disp instanceof Date) return fmtDate(disp);
  if (typeof disp === "number") return disp;
  const s = String(disp).trim();
  return s === "" ? null : s;
}

/** 헤더/샘플용 문자열화 (항상 string, 200자 캡) */
function stringifyCell(value: unknown): string {
  const c = typedCell(value);
  let s: string;
  if (c === null) s = "";
  else if (typeof c === "number") s = String(c);
  else s = c;
  s = s.trim();
  return s.length > MAX_CELL_LEN ? s.slice(0, MAX_CELL_LEN) : s;
}

export async function parseWorkbook(fileName: string, data: ArrayBuffer): Promise<ParsedSheet> {
  try {
    const mod = await import("exceljs");
    const ExcelJS: any = (mod as any).default ?? mod;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data as any);

    const ws = workbook.worksheets[0];
    if (!ws || ws.rowCount === 0) throw emptyErr(fileName);

    // 헤더 (1행). 끝쪽 빈 헤더 컬럼은 잘라냄
    const colCount: number = ws.columnCount || 0;
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    for (let c = 1; c <= colCount; c++) {
      headers.push(stringifyCell(headerRow.getCell(c).value));
    }
    while (headers.length && headers[headers.length - 1] === "") headers.pop();
    const ncol = headers.length;
    if (ncol === 0) throw emptyErr(fileName);

    // 데이터 행 (2행부터). 전부 빈 행은 제외
    const rows: CellValue[][] = [];
    const sampleRows: string[][] = [];
    const lastRow: number = ws.rowCount;
    for (let r = 2; r <= lastRow; r++) {
      const row = ws.getRow(r);
      const typed: CellValue[] = [];
      let hasValue = false;
      for (let c = 1; c <= ncol; c++) {
        const v = typedCell(row.getCell(c).value);
        if (v !== null) hasValue = true;
        typed.push(v);
      }
      if (!hasValue) continue;
      rows.push(typed);
      if (sampleRows.length < MAX_SAMPLE_ROWS) {
        const sample: string[] = [];
        for (let c = 1; c <= ncol; c++) sample.push(stringifyCell(row.getCell(c).value));
        sampleRows.push(sample);
      }
    }

    return { fileName, headers, sampleRows, rowCount: rows.length, rows };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("빈 시트")) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`엑셀 파일을 파싱하지 못했습니다: ${fileName}${msg ? ` (${msg})` : ""}`);
  }
}

export function toFileMeta(sheet: ParsedSheet): FileMeta {
  return {
    fileName: sheet.fileName,
    headers: sheet.headers,
    sampleRows: sheet.sampleRows,
  };
}
