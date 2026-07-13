/**
 * PPT 린터 — 파싱된 스타일 모델 및 위반(검사 결과) 타입.
 *
 * 이 파일은 순수 타입만 담습니다 (server-only 아님 — 클라이언트/노드 공용).
 * 원본 슬라이드 "본문 텍스트"는 이 모델에 절대 포함하지 않습니다.
 * (파서는 서식 메타데이터만 추출하고 <a:t> 본문은 읽지 않습니다.)
 */

export type Severity = "error" | "warning" | "info";

/** 텍스트 런(run) 하나의 서식 정보 (본문 텍스트는 포함하지 않음) */
export interface RunStyle {
  /** <a:latin typeface> — 글꼴 패밀리명 (없으면 null: 상위/마스터 상속) */
  font: string | null;
  /** <a:rPr sz> — 1/100 pt 단위 크기 (없으면 null) */
  sizeHundredths: number | null;
  /** <a:srgbClr val> — 대문자 6자리 hex (scheme 색/없음이면 null) */
  colorHex: string | null;
}

/** 슬라이드 위의 도형 하나 (placeholder 역할 + 위치 + 런 서식) */
export interface ShapeInfo {
  /** <p:ph type> — "title" | "ctrTitle" | "body" | "subTitle" | "ftr" | "sldNum" | "dt" 등. placeholder가 아니면 null */
  placeholderType: string | null;
  /** 제목 계열 placeholder 여부 (title/ctrTitle) */
  isTitle: boolean;
  /** <a:off> EMU 좌표 (없으면 null) */
  offset: { x: number; y: number } | null;
  /** <a:ext> EMU 크기 (없으면 null) */
  extent: { cx: number; cy: number } | null;
  runs: RunStyle[];
}

export interface SlideModel {
  slideNumber: number;
  shapes: ShapeInfo[];
  hasFooter: boolean;
  hasSlideNumber: boolean;
}

export interface ThemeModel {
  /** 테마 major(제목) 글꼴 */
  majorFont: string | null;
  /** 테마 minor(본문) 글꼴 */
  minorFont: string | null;
  /** clrScheme의 srgbClr 값들 (대문자 hex) */
  schemeColors: string[];
}

export interface PresentationModel {
  slides: SlideModel[];
  theme: ThemeModel | null;
}

/** 규칙 위반 하나 */
export interface Violation {
  ruleId: string;
  severity: Severity;
  /** 위반이 발생한 슬라이드 번호 (1부터). 프레젠테이션 전체 위반이면 0 */
  slideNumber: number;
  /** 사용자에게 보여줄 한국어 메시지 (서식 정보만 — 본문 텍스트 없음) */
  message: string;
  /** 부가 설명 (선택) */
  detail?: string;
}

/** 규칙 함수: 파싱된 모델을 받아 위반 배열을 반환하는 순수 함수 */
export type Rule = (model: PresentationModel) => Violation[];
