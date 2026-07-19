"use server";

import { getAvailableProviders, completeStructured } from "@/lib/ai";
import {
  handoverRequestSchema,
  handoverResponseSchema,
  ALL_FIELDS,
  type HandoverRequest,
  type HandoverResponse,
} from "./lib/schema";

type ActionResult =
  | { ok: true; data: HandoverResponse }
  | { ok: false; error: string };

const ERR_INVALID =
  "입력값이 올바르지 않습니다. 최소 한 항목 입력, 전체 30,000자 이하인지 확인하세요.";
const ERR_NO_KEY =
  "선택한 AI 프로바이더의 API 키가 설정되지 않았습니다. .env.local을 확인하세요.";
const ERR_GENERIC =
  "인수인계서 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

const SYSTEM = [
  "당신은 인수인계 문서 작성 전문가입니다.",
  "입력에 없는 사실을 절대 지어내지 마세요 — 빠진 부분은 본문에 임의로 채우지 말고 missingInfo로 지적합니다.",
  "본문 항목은 개조식 간결체(명사형 종결: ~함/~임/~됨)로 정리합니다.",
  "날짜·이름·숫자·금액·고유명사는 입력 그대로 정확히 유지합니다.",
  "비밀번호·PIN·API 키 등 실제 자격증명 값이 입력에 있으면 문서에 그대로 옮기지 말고 '[보안상 별도 전달 필요]'로 대체하고, missingInfo에 안전한 전달 방법(예: 대면·사내 비밀번호 관리도구) 안내를 추가합니다.",
  "응답은 지정된 JSON 스키마를 엄격히 따르세요.",
].join(" ");

function buildPrompt(req: HandoverRequest): string {
  const parts: string[] = [];
  parts.push(
    "아래는 퇴사·부서이동을 앞둔 담당자가 자유롭게 적은 업무 정보입니다."
  );
  parts.push(
    "이를 표준 인수인계서 구조로 정리하고, 인수인계서에 통상 필요한데 입력에 없는 정보는 missingInfo로 지적하세요."
  );
  parts.push("");
  parts.push("작업 지침:");
  parts.push(
    "- title: 부서·담당 업무를 반영한 문서 제목(예: '영업1팀 정산 담당 인수인계서')."
  );
  parts.push(
    "- sections: 입력 내용을 의미 단위로 묶어 heading과 items로 구성. items는 { label, text } 개조식 항목. label은 '담당자'·'마감일'처럼 짧은 앞머리가 자연스러울 때만 쓰고, 아니면 null."
  );
  parts.push(
    "- 입력이 비어 있는 항목의 섹션은 만들지 마세요(내용을 지어내지 말 것)."
  );
  parts.push(
    "- missingInfo: 후임자가 업무를 이어받으려면 필요하지만 입력에 없는 정보를 질문 형태로. 각 항목에 why(왜 필요한지)와 priority(high/medium/low). 예: '법인카드·비품 반납 절차는?', '진행 중 계약의 상대측 담당자 연락처는?', '주요 파일의 접근 권한 신청 방법은?'."
  );
  parts.push(
    "- notes: 전체적으로 유의할 점이 있으면 한두 문장, 없으면 null."
  );
  parts.push("");
  parts.push("=== 입력 시작 ===");
  for (const f of ALL_FIELDS) {
    const value = req[f.key].trim();
    if (value.length === 0) continue;
    parts.push(`## ${f.label}`);
    parts.push(value);
    parts.push("");
  }
  parts.push("=== 입력 끝 ===");
  return parts.join("\n");
}

/**
 * 인수인계서 생성.
 *
 * 프라이버시 주의: 이 액션은 입력한 업무 정보 전체를 선택한 프로바이더로 전송한다.
 * 서버는 입력·결과를 저장하지 않는다.
 */
export async function generateHandover(
  input: HandoverRequest
): Promise<ActionResult> {
  try {
    const parsed = handoverRequestSchema.safeParse(input);
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
      schema: handoverResponseSchema,
      schemaName: "HandoverDocument",
      // 긴 입력 시 생성 문서가 잘려 JSON 파싱이 실패하는 것을 방지(사전 논의됨).
      maxTokens: 16384,
    });

    return { ok: true, data };
  } catch {
    return { ok: false, error: ERR_GENERIC };
  }
}
