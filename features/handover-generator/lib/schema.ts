/**
 * 인수인계서 생성 — 요청/응답 스키마 + 폼 필드 정의.
 *
 * 중요(프라이버시): 이 도구는 성격상 "입력한 업무 정보 전체"를 LLM으로 전송한다.
 * 요청 스키마에 사용자가 적은 업무 내용이 그대로 포함된다. 앱은 이를 저장하지 않는다.
 *
 * 응답 스키마는 Gemini responseJsonSchema 제약을 고려해 단순 타입만 사용한다.
 * (문자열/배열 길이 제약(minLength·maxLength·maxItems)은 금지 — Gemini가 거부한다.
 *  정수 minimum/maximum, nullable(anyOf+null), enum은 허용된다.)
 */
import { z } from "zod";

/** 전체 입력 글자 수 상한. 클라이언트 카운터 + 서버 검증 공용. */
export const MAX_TOTAL_LEN = 30_000;
/** 개별 필드 상한(방어적). 전체 합계 검증과 별개로 단일 필드 폭주를 막는다. */
export const FIELD_MAX_LEN = 10_000;

// ---- 입력 상한 선택(사용자가 고르는 상한) ---------------------------------
// 사용자가 드롭다운으로 고르는 "이번 입력의 상한". 절대 상한(MAX_TOTAL_LEN)을
// 넘을 수 없다. 실효 상한은 항상 min(inputLimit, MAX_TOTAL_LEN)으로 계산한다.

/** 선택 상한 단위(1,000자). */
export const INPUT_LIMIT_STEP = 1_000;
/** 선택 가능한 최소 상한. */
export const INPUT_LIMIT_MIN = 1_000;
/** 선택 가능한 최대 상한 = 절대 상한. */
export const INPUT_LIMIT_MAX = MAX_TOTAL_LEN;
/** 기본 입력 상한. */
export const DEFAULT_INPUT_LIMIT = 5_000;
/** 이 값 이상 선택 시 비용·잘림 안내문 노출. */
export const INPUT_LIMIT_WARN_AT = 10_000;
/** 드롭다운 선택지: 1,000 ~ 30,000 (1,000 단위, 30개). */
export const INPUT_LIMIT_OPTIONS: number[] = Array.from(
  { length: INPUT_LIMIT_MAX / INPUT_LIMIT_STEP },
  (_, i) => (i + 1) * INPUT_LIMIT_STEP
);

/** 유효한 입력 상한인지: 1,000 단위 정수이며 [MIN, MAX] 범위. */
export function isValidInputLimit(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= INPUT_LIMIT_MIN &&
    value <= INPUT_LIMIT_MAX &&
    value % INPUT_LIMIT_STEP === 0
  );
}

/** 저장값 등 임의 입력을 유효한 상한으로 보정(범위 밖·비정상이면 기본값). */
export function normalizeInputLimit(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return isValidInputLimit(n) ? n : DEFAULT_INPUT_LIMIT;
}

/** 선택된 상한의 실효 상한 = min(inputLimit, 절대 상한 30,000). */
export function effectiveInputLimit(inputLimit: number): number {
  return Math.min(inputLimit, MAX_TOTAL_LEN);
}

/** 합계 글자 수가 실효 상한 이내인지. 클라이언트 카운터/서버 검증 공용. */
export function isWithinInputLimit(
  v: Record<FieldKey, string>,
  inputLimit: number
): boolean {
  return totalLength(v) <= effectiveInputLimit(inputLimit);
}

// ---- 폼 필드 정의 (클라이언트 폼 + 서버 프롬프트 공용) ----------------------

/** 인수인계서 입력 필드 키. */
export const FIELD_KEYS = [
  "deptRole",
  "reason",
  "targetDate",
  "overview",
  "ongoing",
  "recurring",
  "stakeholders",
  "systems",
  "resources",
  "etc",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export interface FieldDef {
  key: FieldKey;
  /** 화면 라벨 = AI에게 전달하는 섹션 제목 */
  label: string;
  placeholder: string;
  /** input(짧은 한 줄) 또는 textarea(여러 줄) */
  kind: "input" | "textarea";
  /** 섹션 하단 주의 문구(있을 때만) */
  warning?: string;
}

/** 기본 정보(짧은 input) 필드. */
export const BASIC_FIELDS: FieldDef[] = [
  {
    key: "deptRole",
    label: "부서 / 직책",
    kind: "input",
    placeholder: "예: 영업1팀 대리 · 정산 담당",
  },
  {
    key: "reason",
    label: "인수인계 사유",
    kind: "input",
    placeholder: "예: 육아휴직 / 부서 이동 (마케팅팀)",
  },
  {
    key: "targetDate",
    label: "인수인계 예정일",
    kind: "input",
    placeholder: "예: 2026-07-31",
  },
];

/** 서술형 섹션(textarea) 필드. */
export const SECTION_FIELDS: FieldDef[] = [
  {
    key: "overview",
    label: "담당 업무 개요",
    kind: "textarea",
    placeholder:
      "담당하고 있는 업무를 한눈에 볼 수 있게 적어주세요.\n예)\n- 주간 매출 보고서 작성\n- 협력사 정산 관리\n- 신규 거래처 계약 검토",
  },
  {
    key: "ongoing",
    label: "진행 중인 업무",
    kind: "textarea",
    placeholder:
      "지금 진행 중이라 이어받아야 할 일과 현재 상태를 적어주세요.\n예)\n- A사 계약 갱신 협상 중 — 5월 말 회신 예정, 단가 3% 인하안 검토 중\n- 하반기 프로모션 기획 초안 작성 중 (6/10 팀 공유 예정)",
  },
  {
    key: "recurring",
    label: "반복 업무와 주기",
    kind: "textarea",
    placeholder:
      "정기적으로 반복되는 업무를 주기와 함께 적어주세요.\n예)\n- 매주 월요일: 주간 매출 보고서 작성·팀장 보고\n- 매월 25일: 협력사 정산 마감\n- 분기별: 거래처 실적 리뷰 미팅",
  },
  {
    key: "stakeholders",
    label: "주요 관계자",
    kind: "textarea",
    placeholder:
      "업무상 자주 협업하는 사람과 역할을 적어주세요.\n예)\n- 김OO 과장(경영지원팀) — 정산 승인 담당\n- 이OO 대리(협력사 가나상사) — 납품 일정 조율",
  },
  {
    key: "systems",
    label: "시스템 · 계정",
    kind: "textarea",
    placeholder:
      "업무에 쓰는 시스템·계정과 권한 신청 방법을 적어주세요.\n예)\n- ERP: 회사 계정으로 로그인, 권한 신청은 IT팀 헬프데스크\n- 정산용 공유 스프레드시트: 팀 구글 드라이브",
    warning: "비밀번호 등 실제 자격증명은 절대 입력하지 마세요.",
  },
  {
    key: "resources",
    label: "자료 위치",
    kind: "textarea",
    placeholder:
      "관련 문서·파일이 어디 있는지 경로를 적어주세요.\n예)\n- 공유드라이브/영업팀/2026 계약서/\n- 정산 양식: 팀 위키 > 정산 가이드",
  },
  {
    key: "etc",
    label: "기타 특이사항",
    kind: "textarea",
    placeholder:
      "위 항목에 담기지 않은 인수인계 시 알아둘 점을 적어주세요.\n예)\n- B사는 이메일보다 유선 연락을 선호함\n- 월말 정산 시즌에는 야근이 잦음",
  },
];

/** 모든 필드(순서 = 화면·프롬프트 순서). */
export const ALL_FIELDS: FieldDef[] = [...BASIC_FIELDS, ...SECTION_FIELDS];

// ---- 요청(REQUEST) 검증 스키마 --------------------------------------------

const fieldString = z.string().max(FIELD_MAX_LEN);

export const handoverRequestSchema = z
  .object({
    providerId: z.enum(["anthropic", "openai", "gemini"]),
    inputLimit: z
      .number()
      .int()
      .min(INPUT_LIMIT_MIN)
      .max(INPUT_LIMIT_MAX)
      .refine((n) => n % INPUT_LIMIT_STEP === 0, {
        message: "입력 상한은 1,000자 단위여야 합니다.",
      }),
    deptRole: fieldString,
    reason: fieldString,
    targetDate: fieldString,
    overview: fieldString,
    ongoing: fieldString,
    recurring: fieldString,
    stakeholders: fieldString,
    systems: fieldString,
    resources: fieldString,
    etc: fieldString,
  })
  .refine(
    (v) => FIELD_KEYS.some((k) => v[k].trim().length > 0),
    { message: "최소 한 개의 항목은 입력해야 합니다." }
  )
  .refine((v) => isWithinInputLimit(v, v.inputLimit), {
    message: `전체 입력은 선택한 상한(최대 ${MAX_TOTAL_LEN}자)을 넘을 수 없습니다.`,
  });

export type HandoverRequest = z.infer<typeof handoverRequestSchema>;

/** 폼 값(providerId 제외)의 전체 글자 수. 클라이언트/서버 공용. */
export function totalLength(v: Record<FieldKey, string>): number {
  return FIELD_KEYS.reduce((sum, k) => sum + v[k].length, 0);
}

// ---- 응답(RESPONSE) 스키마 (Gemini 호환: 단순 타입만) ----------------------

export const handoverItemSchema = z.object({
  /** 항목 앞머리 라벨(없으면 null). 예: "담당자", "마감일" */
  label: z.string().nullable(),
  /** 개조식 항목 본문 */
  text: z.string(),
});

export type HandoverItem = z.infer<typeof handoverItemSchema>;

export const handoverSectionSchema = z.object({
  heading: z.string(),
  items: z.array(handoverItemSchema),
});

export type HandoverSection = z.infer<typeof handoverSectionSchema>;

export const missingPrioritySchema = z.enum(["high", "medium", "low"]);
export type MissingPriority = z.infer<typeof missingPrioritySchema>;

export const missingInfoSchema = z.object({
  /** 보완이 필요한 정보를 묻는 질문 */
  question: z.string(),
  /** 왜 필요한지(인수받는 사람 관점) */
  why: z.string(),
  priority: missingPrioritySchema,
});

export type MissingInfo = z.infer<typeof missingInfoSchema>;

export const handoverResponseSchema = z.object({
  title: z.string(),
  sections: z.array(handoverSectionSchema),
  missingInfo: z.array(missingInfoSchema),
  notes: z.string().nullable(),
});

export type HandoverResponse = z.infer<typeof handoverResponseSchema>;
