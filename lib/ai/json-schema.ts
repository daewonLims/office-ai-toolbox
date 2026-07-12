import { z } from "zod";

/**
 * Zod 스키마를 표준 JSON Schema(draft 2020-12)로 변환합니다.
 * Zod v4가 추가하는 최상위 `$schema` 키는 제거합니다.
 * (OpenAI / Gemini가 해당 키를 거부할 수 있습니다.)
 *
 * server-only가 아니므로 클라이언트/서버 어디서나 import 가능합니다.
 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "draft-2020-12",
  }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}
