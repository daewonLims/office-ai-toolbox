"use server";

import { getAvailableProviders, completeStructured } from "@/lib/ai";
import {
  summaryRequestSchema,
  summaryResponseSchema,
  type SummaryRequest,
  type SummaryResponse,
} from "./lib/summary-schema";

type ActionResult =
  | { ok: true; data: SummaryResponse }
  | { ok: false; error: string };

const ERR_INVALID =
  "입력값이 올바르지 않습니다. 위반 항목 수·문자열 길이 제한을 확인하세요.";
const ERR_NO_KEY =
  "선택한 AI 프로바이더의 API 키가 설정되지 않았습니다. .env.local을 확인하세요.";
const ERR_GENERIC =
  "AI 개선 리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

function buildPrompt(input: SummaryRequest): string {
  const parts: string[] = [];
  parts.push(
    "아래는 한 PowerPoint 발표 자료를 서식 린터로 검사한 '스타일 메타데이터와 위반 통계'입니다."
  );
  parts.push("슬라이드 본문 텍스트는 제공되지 않습니다. 통계만으로 판단하세요.");
  parts.push("");
  parts.push(`- 전체 슬라이드 수: ${input.totalSlides}`);
  parts.push(`- 전체 위반 수: ${input.totalViolations}`);
  parts.push(
    `- 심각도별: 오류 ${input.severityCounts.error} · 경고 ${input.severityCounts.warning} · 정보 ${input.severityCounts.info}`
  );
  parts.push(
    `- 기준(다수결) 글꼴: ${input.baselineFont ?? "판단 불가"} / 테마 지정 글꼴: ${
      input.themeMajorFont ?? "없음"
    }`
  );
  parts.push(
    `- 사용된 글꼴(빈도): ${
      input.fonts.map((f) => `${f.name}(${f.count})`).join(", ") || "없음"
    }`
  );
  parts.push(`- 기준 팔레트: ${input.palette.join(", ") || "없음"}`);
  parts.push(
    `- 규칙별 위반 수: ${
      input.ruleCounts.map((r) => `${r.label} ${r.count}건`).join(", ") || "없음"
    }`
  );
  if (input.sampleMessages.length > 0) {
    parts.push("- 대표 위반 메시지:");
    for (const m of input.sampleMessages) parts.push(`  · ${m}`);
  }
  parts.push("");
  parts.push("작업 지침:");
  parts.push(
    "- summary: 발표 자료 서식의 전반적 일관성 상태를 2~3문장 한국어로 요약하세요."
  );
  parts.push(
    "- recommendations: 개선 권고를 우선순위(priority: high/medium/low)와 함께 최대 5개 제시하세요. 각 항목은 title(짧은 제목)과 description(구체적 실행 방법)을 한국어로 작성하세요."
  );
  parts.push(
    "- 통계에 근거해 실용적으로 조언하고, 제공되지 않은 슬라이드 내용은 추측하지 마세요."
  );
  return parts.join("\n");
}

/** AI 개선 리포트 생성 (옵트인). 스타일 메타데이터/위반 통계만 입력으로 받는다. */
export async function generateImprovementReport(
  input: SummaryRequest
): Promise<ActionResult> {
  try {
    const parsed = summaryRequestSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: ERR_INVALID };
    }
    const req = parsed.data;

    const providers = getAvailableProviders();
    const provider = providers.find((p) => p.id === req.providerId);
    if (!provider || !provider.available) {
      return { ok: false, error: ERR_NO_KEY };
    }

    const system =
      "당신은 발표 자료 서식 컨설턴트입니다. 제공된 스타일 통계만으로 서식 일관성을 평가하고, " +
      "실용적인 개선 권고를 제시합니다. 슬라이드 본문 내용은 제공되지 않으므로 추측하지 마세요. " +
      "응답은 지정된 JSON 스키마를 엄격히 따르세요.";

    const data = await completeStructured(req.providerId, {
      system,
      prompt: buildPrompt(req),
      schema: summaryResponseSchema,
      schemaName: "PptLintSummary",
      maxTokens: 2048,
    });

    return { ok: true, data };
  } catch {
    return { ok: false, error: ERR_GENERIC };
  }
}
