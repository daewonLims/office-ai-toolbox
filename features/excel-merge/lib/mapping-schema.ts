/**
 * AI 컬럼 매핑의 요청/응답 스키마 (공용 — server-only 아님).
 *
 * 응답 스키마는 Gemini의 responseJsonSchema 제약을 고려해
 * 단순 object/array/enum/nullable-string 만 사용합니다.
 * (union/record/refinement 등은 응답 스키마 안에서 사용하지 않음)
 */
import { z } from "zod";

export const MAX_FILES = 10;
export const MAX_HEADERS = 100;
export const MAX_SAMPLE_ROWS = 5;
export const MAX_CELL_LEN = 200;
export const MAX_FILENAME_LEN = 200;

export interface FileMeta {
  fileName: string;
  headers: string[];
  sampleRows: string[][];
}

// ---- 요청(REQUEST) 검증 스키마 ----------------------------------------------

export const fileMetaSchema = z.object({
  fileName: z.string().min(1).max(MAX_FILENAME_LEN),
  headers: z.array(z.string().max(MAX_CELL_LEN)).max(MAX_HEADERS),
  sampleRows: z
    .array(z.array(z.string().max(MAX_CELL_LEN)))
    .max(MAX_SAMPLE_ROWS),
});

export const mappingRequestSchema = z
  .object({
    providerId: z.enum(["anthropic", "openai", "gemini"]),
    base: fileMetaSchema,
    sources: z.array(fileMetaSchema),
  })
  .refine((v) => 1 + v.sources.length <= MAX_FILES, {
    message: `파일 수는 최대 ${MAX_FILES}개까지 허용됩니다.`,
    path: ["sources"],
  });

export type MappingRequest = z.infer<typeof mappingRequestSchema>;

// ---- 응답(RESPONSE) 스키마 (Gemini 호환: 단순 타입만) -----------------------

export const confidenceSchema = z.enum(["high", "medium", "low"]);

export const transformKindSchema = z.enum(["none", "date", "phone", "other"]);

export const aiColumnMappingSchema = z.object({
  targetColumn: z.string(),
  sourceColumn: z.string().nullable(),
  confidence: confidenceSchema,
  /** 필요한 결정적 변환 종류 (값 변환은 클라이언트 화이트리스트 함수만 수행) */
  transformKind: transformKindSchema,
  /** transformKind가 "date"일 때 원본 형식 토큰 (허용 목록 밖이면 서버에서 null 처리) */
  dateSourceFormat: z.string().nullable(),
  /** 사람이 읽는 형식 메모 (자유 텍스트, 실행되지 않음) */
  transform: z.string().nullable(),
});

export const fileMappingSchema = z.object({
  fileName: z.string(),
  mappings: z.array(aiColumnMappingSchema),
  notes: z.string().nullable(),
});

export const mappingResponseSchema = z.object({
  files: z.array(fileMappingSchema),
});

export type MappingResponse = z.infer<typeof mappingResponseSchema>;
export type FileMapping = z.infer<typeof fileMappingSchema>;
export type AiColumnMapping = z.infer<typeof aiColumnMappingSchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type TransformKind = z.infer<typeof transformKindSchema>;

// ---- 값 통일(VALUE UNIFICATION) 스키마 --------------------------------------
// 옵트인 기능: 선택한 컬럼의 "고유값 목록"만 LLM에 전송합니다.

export const MAX_UNIQUE_VALUES = 50;
export const MAX_VALUE_LEN = 100;

// 요청 검증
export const valueListSchema = z.object({
  fileName: z.string().min(1).max(MAX_FILENAME_LEN),
  values: z.array(z.string().max(MAX_VALUE_LEN)).max(MAX_UNIQUE_VALUES),
});

export const valueUnificationRequestSchema = z.object({
  providerId: z.enum(["anthropic", "openai", "gemini"]),
  columnName: z.string().min(1).max(MAX_CELL_LEN),
  /** 기준 파일의 고유값(우선 어휘) */
  baseValues: z.array(z.string().max(MAX_VALUE_LEN)).max(MAX_UNIQUE_VALUES),
  /** 소스 파일별 고유값 목록 */
  sources: z.array(valueListSchema).max(MAX_FILES),
});

export type ValueUnificationRequest = z.infer<typeof valueUnificationRequestSchema>;

// 응답 스키마 (Gemini 호환: 단순 타입만)
export const valueMappingSchema = z.object({
  from: z.string(),
  to: z.string(),
  confidence: confidenceSchema,
});

export const valueUnificationResponseSchema = z.object({
  mappings: z.array(valueMappingSchema),
});

export type ValueUnificationResponse = z.infer<typeof valueUnificationResponseSchema>;
export type ValueMapping = z.infer<typeof valueMappingSchema>;
