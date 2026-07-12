import "server-only";
import type { ProviderId, ProviderInfo, StructuredRequest } from "./types";

const META: Record<ProviderId, { label: string; envKey: string; model: () => string }> = {
  anthropic: { label: "Claude (Anthropic)", envKey: "ANTHROPIC_API_KEY", model: () => process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8" },
  openai:    { label: "GPT (OpenAI)",        envKey: "OPENAI_API_KEY",    model: () => process.env.OPENAI_MODEL ?? "gpt-5.6" },
  gemini:    { label: "Gemini (Google)",     envKey: "GEMINI_API_KEY",    model: () => process.env.GEMINI_MODEL ?? "gemini-3.5-flash" },
};

const ORDER: ProviderId[] = ["anthropic", "openai", "gemini"];

export function getAvailableProviders(): ProviderInfo[] {
  return ORDER.map((id) => ({
    id,
    label: META[id].label,
    model: META[id].model(),
    available: Boolean(process.env[META[id].envKey]), // 존재 여부만 — 절대 키 값을 반환하지 않음
  }));
}

export async function completeStructured<T>(providerId: ProviderId, req: StructuredRequest<T>): Promise<T> {
  const meta = META[providerId];
  if (!meta) throw new Error(`알 수 없는 AI 프로바이더입니다: ${providerId}`);
  if (!process.env[meta.envKey]) {
    throw new Error(`${meta.label} API 키가 설정되지 않았습니다. .env.local에 ${meta.envKey}를 추가하세요.`);
  }
  // 지연 import: 프로바이더 목록 조회 시 SDK 로드/클라이언트 생성을 하지 않도록 함
  switch (providerId) {
    case "anthropic": return (await import("./providers/anthropic")).completeStructured(req);
    case "openai":    return (await import("./providers/openai")).completeStructured(req);
    case "gemini":    return (await import("./providers/gemini")).completeStructured(req);
    default: throw new Error(`알 수 없는 AI 프로바이더입니다: ${providerId}`);
  }
}
