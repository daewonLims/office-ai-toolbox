"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ProviderId, ProviderInfo } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "office-ai-toolbox:provider";

interface ProviderContextValue {
  providers: ProviderInfo[];
  providerId: ProviderId | null;
  setProviderId: (id: ProviderId) => void;
}

const ProviderContext = createContext<ProviderContextValue | null>(null);

function isProviderId(value: unknown): value is ProviderId {
  return value === "anthropic" || value === "openai" || value === "gemini";
}

function resolveInitialProvider(
  providers: ProviderInfo[],
  stored: string | null
): ProviderId | null {
  const available = providers.filter((p) => p.available);
  if (available.length === 0) return null;

  if (
    stored !== null &&
    isProviderId(stored) &&
    available.some((p) => p.id === stored)
  ) {
    return stored;
  }

  // Exactly one available -> pick it; otherwise pick the first available.
  return available[0].id;
}

export function ProviderProvider({
  providers,
  children,
}: {
  providers: ProviderInfo[];
  children: React.ReactNode;
}) {
  // Initialize to null to avoid hydration mismatches; resolve in an effect.
  const [providerId, setProviderIdState] = useState<ProviderId | null>(null);

  // Restore + resolve the selected provider once on mount (client-only).
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    setProviderIdState(resolveInitialProvider(providers, stored));
    // Providers come from the server and are stable for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage whenever a (non-null) selection changes.
  useEffect(() => {
    if (providerId === null) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, providerId);
    } catch {
      // Ignore storage failures (e.g. private mode / disabled storage).
    }
  }, [providerId]);

  const setProviderId = useCallback((id: ProviderId) => {
    setProviderIdState(id);
  }, []);

  const value = useMemo<ProviderContextValue>(
    () => ({ providers, providerId, setProviderId }),
    [providers, providerId, setProviderId]
  );

  return (
    <ProviderContext.Provider value={value}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider(): ProviderContextValue {
  const ctx = useContext(ProviderContext);
  if (ctx === null) {
    throw new Error(
      "useProvider는 <ProviderProvider> 내부에서만 사용할 수 있습니다."
    );
  }
  return ctx;
}

export function ProviderSelect() {
  const { providers, providerId, setProviderId } = useProvider();

  const hasAvailable = providers.some((p) => p.available);

  if (providers.length === 0 || !hasAvailable) {
    return (
      <div className="rounded-md border p-2 text-xs text-muted-foreground">
        .env.local에 API 키를 설정하세요
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="provider-select"
        className="text-xs font-medium text-muted-foreground"
      >
        AI 모델
      </label>
      <select
        id="provider-select"
        value={providerId ?? ""}
        onChange={(e) => setProviderId(e.target.value as ProviderId)}
        className={cn(
          "h-8 w-full rounded-md border border-border bg-background px-2 text-sm",
          "outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id} disabled={!p.available}>
            {`${p.label} · ${p.model}${p.available ? "" : " (키 미설정)"}`}
          </option>
        ))}
      </select>
    </div>
  );
}
