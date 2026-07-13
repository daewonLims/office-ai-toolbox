/**
 * PPT 린터 공용 상수 — 보안 상한값 및 규칙 임계값.
 * (클라이언트/노드 공용, server-only 아님)
 */

// ---- 업로드 / zip 보안 상한 -------------------------------------------------

/** 업로드 파일 크기 상한 (원본 .pptx 바이트) */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_UPLOAD_LABEL = "50MB";

/** zip 엔트리 개수 상한 (zip bomb 방어) */
export const MAX_ENTRIES = 2_000;

/** 엔트리 1개당 압축 해제 크기 상한 */
export const MAX_ENTRY_BYTES = 50 * 1024 * 1024; // 50MB

/** 전체 압축 해제 누적 크기 상한 */
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200MB

// ---- 규칙 임계값 ------------------------------------------------------------

/**
 * 제목 위치 편차 임계값 (EMU).
 * OOXML은 1인치 = 914400 EMU. 약 0.5인치(≈457200 EMU) 이상 벗어나면 위반으로 본다.
 */
export const TITLE_POSITION_THRESHOLD_EMU = 457_200;

/** 색상이 "기준 팔레트"로 인정받기 위한 최소 사용 슬라이드 수 */
export const PALETTE_MIN_SLIDES = 2;

/** 그레이스케일(회색 계열) 판정 시 R·G·B 최대 편차 허용치 */
export const GRAYSCALE_TOLERANCE = 12;
