import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { StructuredRequest } from "../types";

const anthropic = new Anthropic(); // ANTHROPIC_API_KEY를 자동으로 읽습니다.
export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export async function completeStructured<T>(req: StructuredRequest<T>): Promise<T> {
  const message = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: req.maxTokens ?? 4096,
    system: req.system,
    messages: [{ role: "user", content: req.prompt }],
    output_config: { format: zodOutputFormat(req.schema) },
  });
  // parsed_output은 SDK가 검증한 객체입니다(거부/실패 시 null일 수 있음).
  const parsed = message.parsed_output;
  if (parsed == null) throw new Error("Anthropic가 구조화 응답을 반환하지 않았습니다.");
  return req.schema.parse(parsed); // 이중 안전망
}
