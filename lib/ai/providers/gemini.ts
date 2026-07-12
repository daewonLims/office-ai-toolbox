import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { StructuredRequest } from "../types";
import { toJsonSchema } from "../json-schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

export async function completeStructured<T>(req: StructuredRequest<T>): Promise<T> {
  const schema = toJsonSchema(req.schema);
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: req.prompt,
    config: {
      systemInstruction: req.system,
      responseMimeType: "application/json",
      responseJsonSchema: schema, // 새 SDK의 표준 JSON Schema 필드
      maxOutputTokens: req.maxTokens,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini가 구조화 응답을 반환하지 않았습니다.");
  return req.schema.parse(JSON.parse(text)); // 이중 안전망
}
