"use server";

import { getAvailableProviders, completeStructured } from "@/lib/ai";
import {
  summarizeRequestSchema,
  summarizeResponseSchema,
  hunksPayloadLength,
  MAX_PAYLOAD_LEN,
  type SummarizeRequest,
  type SummarizeResponse,
} from "./lib/schema";

type ActionResult =
  | { ok: true; data: SummarizeResponse }
  | { ok: false; error: string };

const ERR_INVALID =
  "입력값이 올바르지 않습니다. 변경 내용을 다시 확인해 주세요.";
const ERR_NO_CHANGE = "요약할 변경 내용이 없습니다.";
const ERR_TOO_LARGE = `AI로 전송할 변경 내용이 너무 많습니다 (최대 ${MAX_PAYLOAD_LEN.toLocaleString()}자). 문서를 나누어 비교하거나 변경 범위를 좁혀 주세요.`;
const ERR_NO_KEY =
  "선택한 AI 프로바이더의 API 키가 설정되지 않았습니다. .env.local을 확인하세요.";
const ERR_GENERIC =
  "변경 요약 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

const TYPE_LABEL: Record<SummarizeRequest["hunks"][number]["type"], string> = {
  added: "추가",
  removed: "삭제",
  modified: "수정",
};

const SYSTEM = [
  "당신은 문서 개정 이력을 분석해 변경의 의미를 요약하는 전문가입니다.",
  "입력은 한 문서의 두 버전(이전 A / 새 B) 사이에서 '변경된 문단'만 추린 목록입니다. 변경되지 않은 문단은 입력에 없습니다.",
  "각 변경 훅은 번호(index), 유형(추가/삭제/수정), 이전 문단(oldText), 수정 문단(newText)으로 구성됩니다.",
  "입력에 실제로 존재하는 변경만 근거로 요약하세요 — 입력에 없는 변경을 절대 지어내지 마세요.",
  "숫자·날짜·금액·비율·고유명사는 이전/수정 문단에 적힌 그대로 정확히 인용하세요(임의로 바꾸거나 반올림하지 말 것).",
  "의미가 비슷한 변경들을 category로 묶어 groups로 정리하고, 각 그룹의 hunkIndexes에는 그 그룹에 해당하는 변경 번호만 담으세요(입력에 있는 번호만).",
  "importance는 변경이 사업·의사결정에 미치는 영향 기준으로 판단합니다(수치·일정·조건 변경은 대체로 높게, 단순 문구 다듬기는 낮게).",
  "overallSummary는 전체 변경을 한두 문장으로 요약합니다.",
  "응답은 지정된 JSON 스키마를 엄격히 따르세요. 모든 텍스트는 한국어로 작성합니다.",
].join(" ");

function buildPrompt(req: SummarizeRequest): string {
  const parts: string[] = [];
  parts.push(
    "아래는 두 문서 버전 사이의 변경된 문단 목록입니다. 각 변경의 의미를 분류·요약하세요."
  );
  parts.push("");
  parts.push("=== 변경 목록 시작 ===");
  req.hunks.forEach((h, i) => {
    parts.push(`[변경 ${i}] 유형: ${TYPE_LABEL[h.type]}`);
    parts.push(`- 이전: ${h.oldText ?? "(없음)"}`);
    parts.push(`- 수정: ${h.newText ?? "(없음)"}`);
    parts.push("");
  });
  parts.push("=== 변경 목록 끝 ===");
  return parts.join("\n");
}

/**
 * 문서 버전 간 변경 내용을 의미 단위로 요약.
 *
 * 프라이버시 주의: 이 액션은 '변경된 문단(added/removed/modified)의 원문·수정문'만
 * 선택한 프로바이더로 전송한다. 변경되지 않은 문단과 .docx 파일 원본은 전송하지 않는다.
 * 서버는 입력·결과를 저장하지 않는다.
 */
export async function summarizeChanges(
  input: SummarizeRequest
): Promise<ActionResult> {
  try {
    const parsed = summarizeRequestSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: ERR_INVALID };
    }
    const req = parsed.data;

    if (req.hunks.length === 0) {
      return { ok: false, error: ERR_NO_CHANGE };
    }

    // 절대 상한(30,000자)은 클라이언트 값과 무관하게 서버에서 강제.
    // 초과 시 앞에서부터 잘라 보내지 않고 명확한 오류로 거부한다.
    if (hunksPayloadLength(req.hunks) > MAX_PAYLOAD_LEN) {
      return { ok: false, error: ERR_TOO_LARGE };
    }

    const providers = getAvailableProviders();
    const provider = providers.find((p) => p.id === req.providerId);
    if (!provider || !provider.available) {
      return { ok: false, error: ERR_NO_KEY };
    }

    const data = await completeStructured(req.providerId, {
      system: SYSTEM,
      prompt: buildPrompt(req),
      schema: summarizeResponseSchema,
      schemaName: "DocChangeSummary",
      maxTokens: 8192,
    });

    return { ok: true, data };
  } catch {
    return { ok: false, error: ERR_GENERIC };
  }
}
