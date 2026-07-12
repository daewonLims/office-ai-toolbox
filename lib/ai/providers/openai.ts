import "server-only";
import OpenAI from "openai";
import type { StructuredRequest } from "../types";
import { toJsonSchema } from "../json-schema";

const openai = new OpenAI(); // OPENAI_API_KEY를 자동으로 읽습니다.
export const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6";

export async function completeStructured<T>(req: StructuredRequest<T>): Promise<T> {
  const schema = toJsonSchema(req.schema); // $schema 제거됨
  const response = await openai.responses.create({
    model: MODEL,
    instructions: req.system,
    input: req.prompt,
    max_output_tokens: req.maxTokens,
    text: {
      format: {
        type: "json_schema",
        name: req.schemaName,
        schema,
        strict: true,
      },
    },
  });
  const text = response.output_text;
  if (!text) throw new Error("OpenAI가 구조화 응답을 반환하지 않았습니다.");
  return req.schema.parse(JSON.parse(text)); // 이중 안전망
}
