/**
 * AI 개선 리포트(옵트인)의 요청/응답 스키마.
 *
 * 중요(프라이버시): 요청 스키마에는 "슬라이드 본문 텍스트"가 들어갈 자리를 두지 않는다.
 * 오직 스타일 메타데이터(글꼴/색상/위반 통계)만 전송한다.
 * 응답 스키마는 Gemini responseJsonSchema 제약을 고려해 단순 타입만 사용한다.
 */
import { z } from "zod";

export const MAX_FONTS = 50;
export const MAX_PALETTE = 50;
export const MAX_RULE_COUNTS = 20;
export const MAX_SAMPLE_MESSAGES = 30;
export const MAX_VIOLATIONS = 500;
export const MAX_MSG_LEN = 300;
export const MAX_NAME_LEN = 100;

// ---- 요청(REQUEST) 검증 스키마 ----------------------------------------------

export const fontStatSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_LEN),
  count: z.number().int().nonnegative().max(1_000_000),
});

export const ruleCountSchema = z.object({
  ruleId: z.string().min(1).max(MAX_NAME_LEN),
  label: z.string().min(1).max(MAX_NAME_LEN),
  count: z.number().int().nonnegative().max(MAX_VIOLATIONS),
});

export const severityCountsSchema = z.object({
  error: z.number().int().nonnegative().max(MAX_VIOLATIONS),
  warning: z.number().int().nonnegative().max(MAX_VIOLATIONS),
  info: z.number().int().nonnegative().max(MAX_VIOLATIONS),
});

export const summaryRequestSchema = z.object({
  providerId: z.enum(["anthropic", "openai", "gemini"]),
  totalSlides: z.number().int().positive().max(10_000),
  totalViolations: z.number().int().nonnegative().max(MAX_VIOLATIONS),
  baselineFont: z.string().max(MAX_NAME_LEN).nullable(),
  themeMajorFont: z.string().max(MAX_NAME_LEN).nullable(),
  fonts: z.array(fontStatSchema).max(MAX_FONTS),
  palette: z.array(z.string().max(9)).max(MAX_PALETTE),
  ruleCounts: z.array(ruleCountSchema).max(MAX_RULE_COUNTS),
  severityCounts: severityCountsSchema,
  /** 대표 위반 메시지 (서식 정보만 — 슬라이드 본문 텍스트 아님) */
  sampleMessages: z.array(z.string().max(MAX_MSG_LEN)).max(MAX_SAMPLE_MESSAGES),
});

export type SummaryRequest = z.infer<typeof summaryRequestSchema>;

// ---- 응답(RESPONSE) 스키마 (Gemini 호환: 단순 타입만) -----------------------

export const prioritySchema = z.enum(["high", "medium", "low"]);

export const recommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: prioritySchema,
});

export const summaryResponseSchema = z.object({
  summary: z.string(),
  recommendations: z.array(recommendationSchema),
});

export type SummaryResponse = z.infer<typeof summaryResponseSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type Priority = z.infer<typeof prioritySchema>;
