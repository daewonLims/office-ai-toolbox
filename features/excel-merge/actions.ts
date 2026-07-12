"use server";

import { getAvailableProviders, completeStructured } from "@/lib/ai";
import {
  mappingRequestSchema,
  mappingResponseSchema,
  valueUnificationRequestSchema,
  valueUnificationResponseSchema,
  type MappingRequest,
  type MappingResponse,
  type ValueUnificationRequest,
  type ValueUnificationResponse,
  type FileMeta,
} from "./lib/mapping-schema";
import { DATE_FORMAT_TOKENS, isKnownDateFormat } from "./lib/normalize";

type ActionResult =
  | { ok: true; data: MappingResponse }
  | { ok: false; error: string };

type UnifyResult =
  | { ok: true; data: ValueUnificationResponse }
  | { ok: false; error: string };

const ERR_INVALID =
  "입력값이 올바르지 않습니다. 파일 수·컬럼 수·샘플 행 수 제한을 확인하세요.";
const ERR_NO_KEY =
  "선택한 AI 프로바이더의 API 키가 설정되지 않았습니다. .env.local을 확인하세요.";
const ERR_GENERIC =
  "AI 컬럼 매핑 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/** 헤더 + 샘플 행을 프롬프트용 텍스트 블록으로 변환 */
function fileBlock(label: string, file: FileMeta): string {
  const lines: string[] = [];
  lines.push(`### ${label}: ${file.fileName}`);
  lines.push(`헤더: ${file.headers.map((h) => `"${h}"`).join(", ")}`);
  if (file.sampleRows.length > 0) {
    lines.push("샘플 행:");
    file.sampleRows.forEach((row, i) => {
      lines.push(`  ${i + 1}) ${row.map((c) => `"${c}"`).join(", ")}`);
    });
  } else {
    lines.push("샘플 행: (없음)");
  }
  return lines.join("\n");
}

function buildPrompt(input: MappingRequest): string {
  const parts: string[] = [];
  parts.push("아래 기준 양식(기준 템플릿)과 소스 파일들을 분석하세요.");
  parts.push("");
  parts.push(fileBlock("기준 양식", input.base));
  parts.push("");
  input.sources.forEach((src, i) => {
    parts.push(fileBlock(`소스 파일 ${i + 1}`, src));
    parts.push("");
  });
  parts.push("작업 지침:");
  parts.push(
    "- 기준 양식의 각 컬럼에 대해, 각 소스 파일에서 의미가 같은 컬럼을 찾아 매핑하세요."
  );
  parts.push(
    "  (예: 성명=이름=담당자, 입사일=입사날짜=Join Date 처럼 명칭이 달라도 의미가 같으면 대응)"
  );
  parts.push("- 대응되는 컬럼이 없으면 sourceColumn 을 null 로 두세요.");
  parts.push(
    "- confidence 는 확신도를 high/medium/low 중 하나로 표시하세요."
  );
  parts.push(
    "- 각 매핑에 transformKind 를 지정하세요: 값 변환이 필요 없으면 \"none\", 날짜 컬럼이면 \"date\", 전화번호 컬럼이면 \"phone\", 그 외 형식 차이(단위 등)가 있으면 \"other\"."
  );
  parts.push(
    "- transformKind 가 \"date\" 이면 dateSourceFormat 에 소스 샘플에서 판단한 원본 날짜 형식 토큰을 아래 목록 중에서만 골라 넣으세요. 그 외 transformKind 에서는 dateSourceFormat 을 null 로 두세요."
  );
  parts.push(
    `  허용 날짜 형식 토큰: ${DATE_FORMAT_TOKENS.map((t) => `"${t}"`).join(", ")}`
  );
  parts.push(
    '  (예: 샘플이 "2022/04/11" 이면 "YYYY/MM/DD", "03-15-2022" 이면 "MM-DD-YYYY", "20220411" 이면 "YYYYMMDD")'
  );
  parts.push(
    '- transform 필드는 사람이 읽는 형식 메모입니다. 형식 차이가 있으면 한국어로 간단히 설명하고(예: "미국식 날짜 → YYYY-MM-DD"), 없으면 null. 이 텍스트는 실행되지 않습니다.'
  );
  parts.push(
    "- **sourceColumn 은 반드시 해당 소스 파일의 헤더 중 하나이거나 null 이어야 합니다.** 존재하지 않는 컬럼명을 지어내지 마세요."
  );
  parts.push(
    "- 각 소스 파일마다, 기준 양식의 모든 컬럼에 대해 매핑 항목을 하나씩 생성하세요 (files[].mappings)."
  );
  parts.push(
    "- files[].fileName 은 해당 소스 파일의 파일명과 정확히 일치시키세요."
  );
  return parts.join("\n");
}

export async function runColumnMapping(
  input: MappingRequest
): Promise<ActionResult> {
  try {
    const parsed = mappingRequestSchema.safeParse(input);
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
      "당신은 엑셀 취합 어시스턴트입니다. 서로 다른 엑셀 파일의 컬럼을 기준 양식의 컬럼에 정확히 매핑합니다. " +
      "추측으로 존재하지 않는 컬럼명을 만들어내지 말고, 반드시 제공된 소스 파일의 실제 헤더만 사용하세요. " +
      "응답은 지정된 JSON 스키마를 엄격히 따르세요.";
    const prompt = buildPrompt(req);

    const data = await completeStructured(req.providerId, {
      system,
      prompt,
      schema: mappingResponseSchema,
      schemaName: "ColumnMapping",
      maxTokens: 4096,
    });

    // 서버측 보정: sourceColumn 이 실제 헤더가 아니면 null/low 로 강등
    const headersByName = new Map<string, Set<string>>();
    headersByName.set(req.base.fileName, new Set(req.base.headers));
    for (const src of req.sources) {
      headersByName.set(src.fileName, new Set(src.headers));
    }

    const corrected: MappingResponse = {
      files: data.files.map((file) => {
        const validHeaders = headersByName.get(file.fileName);
        return {
          fileName: file.fileName,
          notes: file.notes,
          mappings: file.mappings.map((m) => {
            // 날짜 형식 토큰 보정: date 가 아니거나 허용 토큰 밖이면 null
            const dateSourceFormat =
              m.transformKind === "date" && isKnownDateFormat(m.dateSourceFormat)
                ? m.dateSourceFormat
                : null;
            const normalized = { ...m, dateSourceFormat };
            if (
              m.sourceColumn !== null &&
              (!validHeaders || !validHeaders.has(m.sourceColumn))
            ) {
              return { ...normalized, sourceColumn: null, confidence: "low" as const };
            }
            return normalized;
          }),
        };
      }),
    };

    return { ok: true, data: corrected };
  } catch {
    return { ok: false, error: ERR_GENERIC };
  }
}

// ---- 값 통일 제안 (옵트인) --------------------------------------------------

function buildUnifyPrompt(input: ValueUnificationRequest): string {
  const parts: string[] = [];
  parts.push(
    `아래는 취합 대상 컬럼 "${input.columnName}" 에 등장하는 값들의 목록입니다.`
  );
  parts.push("서로 다른 파일에서 같은 의미로 쓰인 값들을 하나의 표기로 통일하세요.");
  parts.push("");
  parts.push(
    `기준 값 어휘(우선 사용): ${input.baseValues.map((v) => `"${v}"`).join(", ") || "(없음)"}`
  );
  parts.push("");
  input.sources.forEach((s) => {
    parts.push(
      `소스 "${s.fileName}" 의 값: ${s.values.map((v) => `"${v}"`).join(", ") || "(없음)"}`
    );
  });
  parts.push("");
  parts.push("작업 지침:");
  parts.push(
    "- 기준 값 어휘를 우선 사용해 소스 값들을 통일하세요 (예: 소스의 \"Sales\" 가 기준의 \"영업1팀\" 과 같은 의미면 to=\"영업1팀\")."
  );
  parts.push("- 확실히 대응되는 경우에만 매핑하고, 애매하면 그대로 두세요(to=원래 값).");
  parts.push(
    "- mappings 의 각 항목에서 from 은 위에 제시된 값 중 하나여야 합니다. 없는 값을 지어내지 마세요."
  );
  parts.push("- confidence 로 확신도를 high/medium/low 로 표시하세요.");
  return parts.join("\n");
}

export async function suggestValueUnification(
  input: ValueUnificationRequest
): Promise<UnifyResult> {
  try {
    const parsed = valueUnificationRequestSchema.safeParse(input);
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
      "당신은 엑셀 취합 어시스턴트입니다. 여러 파일에 흩어진 범주형 값들을 하나의 일관된 표기로 통일합니다. " +
      "제시된 값 목록에 없는 값을 지어내지 말고, 애매하면 원래 값을 유지하세요. 응답은 지정된 JSON 스키마를 엄격히 따르세요.";
    const prompt = buildUnifyPrompt(req);

    const data = await completeStructured(req.providerId, {
      system,
      prompt,
      schema: valueUnificationResponseSchema,
      schemaName: "ValueUnification",
      maxTokens: 2048,
    });

    // 서버측 보정: from 이 실제 전송된 고유값에 없으면 제거
    const allowed = new Set<string>(req.baseValues);
    for (const s of req.sources) for (const v of s.values) allowed.add(v);

    const seen = new Set<string>();
    const mappings = data.mappings.filter((m) => {
      if (!allowed.has(m.from)) return false;
      if (seen.has(m.from)) return false; // from 중복 제거
      seen.add(m.from);
      return true;
    });

    return { ok: true, data: { mappings } };
  } catch {
    return { ok: false, error: ERR_GENERIC };
  }
}
