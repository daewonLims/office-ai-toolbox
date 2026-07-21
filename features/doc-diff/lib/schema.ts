/**
 * 문서 버전 비교 — 요청/응답 스키마 + 공용 상수.
 *
 * 중요(프라이버시): AI 요약은 "변경된 문단(added/removed/modified)의 원문·수정문"만
 * 전송한다. 변경되지 않은(unchanged) 문단과 .docx 파일 원본은 절대 전송하지 않는다.
 * 요청 스키마에는 변경 훅(hunk)의 old/new 텍스트만 담긴다. 앱은 이를 저장하지 않는다.
 *
 * 응답 스키마는 Gemini responseJsonSchema 제약을 고려해 단순 타입만 사용한다.
 * (문자열/배열 길이 제약(minLength·maxLength·maxItems)은 금지 — Gemini가 거부한다.
 *  정수 minimum/maximum, nullable(anyOf+null), enum은 허용된다.)
 */
import { z } from "zod";

/** 문서 1개당 입력 글자 수 상한. 클라이언트 안내 + 추출 시 차단 공용. */
export const MAX_DOC_LEN = 30_000;

/**
 * AI로 전송하는 변경 훅 전체 텍스트(old+new 합계)의 절대 상한.
 * 클라이언트 값과 무관하게 서버에서 강제한다. 초과 시 잘라 보내지 않고 거부한다.
 */
export const MAX_PAYLOAD_LEN = 30_000;

/** 한 번에 전송 가능한 변경 훅 개수 상한(방어적). */
export const MAX_HUNKS = 2_000;

// ---- 요청(REQUEST) 검증 스키마 --------------------------------------------

/** AI로 전송되는 변경 훅. unchanged는 포함되지 않는다. */
export const hunkInputSchema = z.object({
  type: z.enum(["added", "removed", "modified"]),
  /** 이전 버전(A)의 문단. added는 null. */
  oldText: z.string().max(MAX_DOC_LEN).nullable(),
  /** 새 버전(B)의 문단. removed는 null. */
  newText: z.string().max(MAX_DOC_LEN).nullable(),
});

export type HunkInput = z.infer<typeof hunkInputSchema>;

export const summarizeRequestSchema = z.object({
  providerId: z.enum(["anthropic", "openai", "gemini"]),
  hunks: z.array(hunkInputSchema).max(MAX_HUNKS),
});

export type SummarizeRequest = z.infer<typeof summarizeRequestSchema>;

/** 훅 배열이 AI로 실어 보내는 총 텍스트 길이(old+new 합계). 클라이언트/서버 공용. */
export function hunksPayloadLength(hunks: HunkInput[]): number {
  return hunks.reduce(
    (sum, h) => sum + (h.oldText?.length ?? 0) + (h.newText?.length ?? 0),
    0
  );
}

// ---- 응답(RESPONSE) 스키마 (Gemini 호환: 단순 타입만) ----------------------

/** 변경 그룹 분류. */
export const changeCategorySchema = z.enum([
  "수치 변경",
  "일정 변경",
  "문구 다듬기",
  "내용 추가",
  "내용 삭제",
  "조건·범위 변경",
  "기타",
]);

export type ChangeCategory = z.infer<typeof changeCategorySchema>;

/** 변경 중요도. */
export const importanceSchema = z.enum(["high", "medium", "low"]);
export type Importance = z.infer<typeof importanceSchema>;

export const changeGroupSchema = z.object({
  category: changeCategorySchema,
  /** 이 그룹 변경의 의미 요약(한국어). */
  summary: z.string(),
  importance: importanceSchema,
  /** 이 그룹에 속하는 변경 훅의 인덱스(전송한 hunks 배열 기준, 0-base). */
  hunkIndexes: z.array(z.number().int().min(0)),
});

export type ChangeGroup = z.infer<typeof changeGroupSchema>;

export const summarizeResponseSchema = z.object({
  /** 전체 변경을 아우르는 한두 문장 요약. */
  overallSummary: z.string(),
  groups: z.array(changeGroupSchema),
});

export type SummarizeResponse = z.infer<typeof summarizeResponseSchema>;
