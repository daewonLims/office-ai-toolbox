/**
 * 엑셀 취합 기능에서 사용하는 공용 타입 정의.
 * (server-only 아님 — 브라우저/서버 어디서나 import 가능)
 */

/** 셀에 담길 수 있는 정규화된 값 */
export type CellValue = string | number | null;

/** 업로드된 엑셀 시트를 파싱한 결과 */
export interface ParsedSheet {
  fileName: string;
  /** 1행 헤더 (문자열화 + trim) */
  headers: string[];
  /** 최대 5개의 샘플 행 (각 셀 문자열화, 200자 캡) */
  sampleRows: string[][];
  /** 데이터 행 수 (헤더 제외) */
  rowCount: number;
  /** 전체 데이터 행 (타입 유지 — 실무상 클라이언트 전용) */
  rows: CellValue[][];
}

/** 원본 컬럼을 표준 양식의 컬럼에 대응시키는 매핑 */
export interface ColumnMapping {
  sourceHeader: string;
  targetHeader: string;
  /** 자동 매핑 신뢰도 (0~1) */
  confidence?: number;
}

/** 여러 시트를 표준 양식으로 취합한 결과 */
export interface MergeResult {
  targetHeaders: string[];
  rows: string[][];
  mappings: ColumnMapping[];
  sourceFiles: string[];
}
