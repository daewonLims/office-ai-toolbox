/**
 * 개조식 변환기 — 요청/응답 스키마.
 *
 * 중요(프라이버시): 이 도구는 성격상 "입력 텍스트 전체"를 LLM으로 전송한다.
 * 다른 도구와 달리 요청 스키마에 원문 텍스트(text)가 포함된다. 앱은 이를 저장하지 않는다.
 *
 * 응답 스키마는 Gemini responseJsonSchema 제약을 고려해 단순 타입만 사용한다.
 * 계층 기호(□ ○ - 등)는 LLM이 아니라 클라이언트가 프리셋에 맞춰 결정적으로 부여한다.
 */
import { z } from "zod";

/** 입력 텍스트 상한(글자 수). 클라이언트 표시 + 서버 검증 공용. */
export const MAX_TEXT_LEN = 20_000;
/**
 * 참고: 응답(RESPONSE) 스키마에는 문자열/배열 길이 제약(minLength·maxLength·maxItems)을
 * 두지 않는다. Gemini의 responseJsonSchema가 해당 키를 거부(INVALID_ARGUMENT)하기 때문이다.
 * (정수 minimum/maximum, nullable(anyOf+null)은 허용된다.)
 */

// ---- 옵션 enum -------------------------------------------------------------

/** 변환 방향: 서술식→개조식(기본) / 개조식→서술식 */
export const directionSchema = z.enum(["to-outline", "to-prose"]);
export type Direction = z.infer<typeof directionSchema>;

/** 문체 프리셋(개조식 방향에서만 의미가 있음) */
export const presetSchema = z.enum(["public", "corporate", "meeting"]);
export type Preset = z.infer<typeof presetSchema>;

// ---- 요청(REQUEST) 검증 스키마 --------------------------------------------

export const convertRequestSchema = z.object({
  providerId: z.enum(["anthropic", "openai", "gemini"]),
  /** 변환 대상 원문. 이 도구는 본질상 텍스트 전체를 전송한다. */
  text: z.string().min(1).max(MAX_TEXT_LEN),
  direction: directionSchema,
  preset: presetSchema,
});

export type ConvertRequest = z.infer<typeof convertRequestSchema>;

// ---- 응답(RESPONSE) 스키마 (Gemini 호환: 단순 타입만) ----------------------

/**
 * lines: 계층 구조를 담는 평평한 배열. level(0~3)로 깊이를 표현한다.
 *  - to-outline: 프리셋 기호 체계에 맞는 계층
 *  - to-prose:   level 0 문단들
 * text에는 계층 기호(□○- 등)를 포함하지 않는다 — 클라이언트가 붙인다.
 * notes: 변환 시 유의점(있을 때만), 없으면 null.
 */
export const outlineLineSchema = z.object({
  level: z.number().int().min(0).max(3),
  text: z.string(),
});

export type OutlineLine = z.infer<typeof outlineLineSchema>;

export const convertResponseSchema = z.object({
  lines: z.array(outlineLineSchema),
  notes: z.string().nullable(),
});

export type ConvertResponse = z.infer<typeof convertResponseSchema>;
