import type { z } from "zod";

export type ProviderId = "anthropic" | "openai" | "gemini";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  model: string;
  available: boolean;
}

export interface StructuredRequest<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
}
