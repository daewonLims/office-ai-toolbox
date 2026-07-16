"use server";

import { getAvailableProviders, completeStructured } from "@/lib/ai";
import {
  convertRequestSchema,
  convertResponseSchema,
  type ConvertRequest,
  type ConvertResponse,
} from "./lib/schema";

type ActionResult =
  | { ok: true; data: ConvertResponse }
  | { ok: false; error: string };

const ERR_INVALID =
  "입력값이 올바르지 않습니다. 텍스트 길이(최대 20,000자)와 옵션을 확인하세요.";
const ERR_NO_KEY =
  "선택한 AI 프로바이더의 API 키가 설정되지 않았습니다. .env.local을 확인하세요.";
const ERR_GENERIC =
  "변환 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

const SYSTEM =
  "당신은 한국 조직 보고서 문체 전문가입니다. " +
  "의미를 왜곡하지 말고, 원문에 없는 내용을 새로 추가하지 마세요. " +
  "숫자·고유명사·날짜·수치는 원문 그대로 정확히 유지하세요. " +
  "계층 기호(□ ○ - · 1. 1) 등)는 절대 텍스트에 포함하지 마세요 — 계층은 level 값(0~3)으로만 표현하고, " +
  "기호는 클라이언트가 부여합니다. 응답은 지정된 JSON 스키마를 엄격히 따르세요.";

/** 개조식 방향의 프리셋별 문체 지침(기호 체계·어미 규칙·예시 1개). */
const OUTLINE_PRESETS: Record<ConvertRequest["preset"], string> = {
  public: [
    "[문체 프리셋: 공공기관형]",
    "- 계층 체계(참고용, 기호는 넣지 말 것): level 0 = 대주제(□), level 1 = 세부/근거(○), level 2 = 실무 항목(-), level 3 = 부가(·).",
    "- 종결어미: 명사형 개조체. '~함/~임/~됨/~요함' 등 체언·명사형으로 끝맺는다. 서술형 문장('~하였다', '~이다')을 쓰지 않는다.",
    "- 문장은 짧고 간결하게. 조사·군더더기를 줄인다.",
    "예시) 원문: '신규 고객이 전년 대비 15% 증가하였다.' → { level: 0, text: '신규 고객 전년 대비 15% 증가함' }",
  ].join("\n"),
  corporate: [
    "[문체 프리셋: 기업 보고형]",
    "- 계층 체계(참고용, 기호는 넣지 말 것): level 0 = 번호 항목(1.), level 1 = 하위 항목(1)), level 2 = 세부(-), level 3 = 부가(·).",
    "- 종결어미: 간결 명사형(체언 종결). 핵심만 남긴 명사구 위주로 작성한다.",
    "- 수치·성과는 앞세워 임팩트 있게 요약한다.",
    "예시) 원문: '이번 프로모션으로 매출이 20% 늘었다.' → { level: 0, text: '프로모션 통해 매출 20% 증가' }",
  ].join("\n"),
  meeting: [
    "[문체 프리셋: 회의록형]",
    "- 계층 체계(참고용, 기호는 넣지 말 것): level 0 = 안건/논의, level 1 = 세부 논의, level 2 = 하위.",
    "- 결정사항은 텍스트 앞에 '[결정] ', 실행할 조치·할당은 '[조치] '를 붙인다. 단순 논의는 접두어 없이 작성한다.",
    "- 담당자·기한이 원문에 있으면 조치 항목에 함께 남긴다(없으면 지어내지 않는다).",
    "예시) 원문: '다음 주까지 김대리가 예산안을 다시 작성하기로 했다.' → { level: 0, text: '[조치] 김대리, 예산안 재작성 (~다음 주)' }",
  ].join("\n"),
};

function buildPrompt(req: ConvertRequest): string {
  const parts: string[] = [];

  if (req.direction === "to-outline") {
    parts.push(
      "아래 '서술식(줄글)' 텍스트를 한국 조직 보고서용 '개조식'으로 변환하세요."
    );
    parts.push(
      "핵심 내용을 계층(level 0~3)으로 구조화하고, 각 라인은 프리셋 문체 규칙을 따르세요."
    );
    parts.push("");
    parts.push(OUTLINE_PRESETS[req.preset]);
    parts.push("");
    parts.push("작업 지침:");
    parts.push(
      "- lines: 각 항목을 { level, text }로. level은 계층 깊이(0=최상위). text에는 기호를 넣지 않는다."
    );
    parts.push(
      "- 원문의 논리 흐름을 유지하되 중복을 정리하고, 없는 정보를 추가하지 않는다."
    );
    parts.push(
      "- 숫자·비율·금액·날짜·고유명사는 원문 그대로 보존한다."
    );
    parts.push(
      "- notes: 변환 시 유의점이 있으면(모호한 부분, 판단이 필요한 부분 등) 한 문장으로. 없으면 null."
    );
  } else {
    parts.push(
      "아래 '개조식(개요·불릿)' 텍스트를 자연스러운 '서술식(줄글)' 문장으로 변환하세요."
    );
    parts.push("작업 지침:");
    parts.push(
      "- 계층 기호(□ ○ - · 1. 1) 등)와 불릿을 제거하고, 완결된 서술형 문장으로 풀어쓴다."
    );
    parts.push(
      "- 종결어미는 '~하였다/~이다/~한다' 등 자연스러운 서술체를 쓴다."
    );
    parts.push(
      "- lines: 문단 단위로 나누고 모두 level 0 으로 반환한다(계층 없음)."
    );
    parts.push(
      "- 원문의 의미·수치·고유명사를 정확히 유지하고, 없는 내용을 추가하지 않는다."
    );
    parts.push(
      "- notes: 변환 시 유의점이 있으면 한 문장으로. 없으면 null."
    );
  }

  parts.push("");
  parts.push("=== 원문 시작 ===");
  parts.push(req.text);
  parts.push("=== 원문 끝 ===");
  return parts.join("\n");
}

/**
 * 개조식 ↔ 서술식 변환.
 *
 * 프라이버시 주의: 이 액션은 입력 텍스트 전체를 선택한 프로바이더로 전송한다.
 * (변환 기능의 본질) 서버는 텍스트를 저장하지 않는다.
 */
export async function convertText(input: ConvertRequest): Promise<ActionResult> {
  try {
    const parsed = convertRequestSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: ERR_INVALID };
    }
    const req = parsed.data;

    const providers = getAvailableProviders();
    const provider = providers.find((p) => p.id === req.providerId);
    if (!provider || !provider.available) {
      return { ok: false, error: ERR_NO_KEY };
    }

    const data = await completeStructured(req.providerId, {
      system: SYSTEM,
      prompt: buildPrompt(req),
      schema: convertResponseSchema,
      schemaName: "OutlineConversion",
      maxTokens: 4096,
    });

    return { ok: true, data };
  } catch {
    return { ok: false, error: ERR_GENERIC };
  }
}
