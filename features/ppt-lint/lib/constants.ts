/**
 * PPT 린터 공용 상수 — 규칙 임계값.
 * (클라이언트/노드 공용, server-only 아님)
 *
 * 업로드/zip 보안 상한은 공유 코어(@/lib/safe-zip)로 승격되었다.
 * 업로더 UI가 참조하는 두 값만 호환을 위해 재노출한다.
 */

export { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/safe-zip";

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
