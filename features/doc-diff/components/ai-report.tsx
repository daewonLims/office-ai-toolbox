"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useProvider } from "@/components/provider-select";

import { summarizeChanges } from "../actions";
import {
  MAX_PAYLOAD_LEN,
  hunksPayloadLength,
  type ChangeCategory,
  type HunkInput,
  type Importance,
  type SummarizeResponse,
} from "../lib/schema";
import { ConsentDialog } from "./consent-dialog";

const CONSENT_KEY = "office-ai-toolbox:doc-diff-consent";

const IMPORTANCE_META: Record<
  Importance,
  { label: string; className: string }
> = {
  high: {
    label: "중요",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
  medium: {
    label: "보통",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  low: {
    label: "낮음",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
};

const IMPORTANCE_ORDER: Record<Importance, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const CATEGORY_CLASS: Record<ChangeCategory, string> = {
  "수치 변경": "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  "일정 변경":
    "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  "문구 다듬기": "bg-muted text-muted-foreground",
  "내용 추가":
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  "내용 삭제": "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  "조건·범위 변경":
    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  기타: "bg-muted text-muted-foreground",
};

function readConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

function saveConsent(): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, "1");
  } catch {
    // 저장 실패는 무시(프라이빗 모드 등)
  }
}

export function AiReport({
  hunkInputs,
  onFocusHunks,
}: {
  hunkInputs: HunkInput[];
  /** 그룹의 변경 번호 클릭 시 해당 훅을 하이라이트/스크롤. */
  onFocusHunks: (indexes: number[]) => void;
}) {
  const { providerId, providers } = useProvider();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SummarizeResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const currentProvider = providers.find((p) => p.id === providerId) ?? null;
  const hasProvider = providers.some((p) => p.available) && providerId !== null;

  const payloadLength = hunksPayloadLength(hunkInputs);
  const overPayload = payloadLength > MAX_PAYLOAD_LEN;
  const canRun = hasProvider && hunkInputs.length > 0 && !overPayload && !isLoading;

  const sortedGroups =
    result === null
      ? []
      : [...result.groups].sort(
          (a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]
        );

  const doSummarize = async () => {
    if (!providerId || overPayload || hunkInputs.length === 0) return;
    setIsLoading(true);
    setResult(null);
    try {
      const res = await summarizeChanges({ providerId, hunks: hunkInputs });
      if (res.ok) {
        setResult(res.data);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("요약에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    if (!canRun) return;
    if (readConsent()) {
      void doSummarize();
    } else {
      setDialogOpen(true);
    }
  };

  const handleConfirm = (dontShowAgain: boolean) => {
    if (dontShowAgain) saveConsent();
    setDialogOpen(false);
    void doSummarize();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleClick} disabled={!canRun}>
          {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          AI로 변경 내용 요약
        </Button>
        <span className="text-xs text-muted-foreground">
          변경된 문단의 원문·수정문만 전송됩니다 (변경되지 않은 문단·원본 파일
          미전송)
        </span>
      </div>

      {!hasProvider && (
        <p className="text-xs text-muted-foreground">
          AI 모델이 설정되지 않았습니다. 좌측 하단에서 프로바이더를 선택하거나
          .env.local에 API 키를 추가하세요.
        </p>
      )}
      {overPayload && (
        <p className="text-xs text-destructive">
          변경 내용이 전송 상한({MAX_PAYLOAD_LEN.toLocaleString()}자)을
          초과했습니다({payloadLength.toLocaleString()}자). 변경 범위를 좁혀
          주세요.
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4 text-primary" />
                전체 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{result.overallSummary}</p>
            </CardContent>
          </Card>

          {sortedGroups.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {sortedGroups.map((group, i) => {
                const importance = IMPORTANCE_META[group.importance];
                const validIndexes = group.hunkIndexes.filter(
                  (n) => n >= 0 && n < hunkInputs.length
                );
                return (
                  <Card key={i} className="min-w-0">
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={cn(
                            "inline-flex h-5 items-center rounded px-1.5 text-xs font-medium",
                            CATEGORY_CLASS[group.category]
                          )}
                        >
                          {group.category}
                        </span>
                        <span
                          className={cn(
                            "inline-flex h-5 items-center rounded px-1.5 text-xs font-medium",
                            importance.className
                          )}
                        >
                          {importance.label}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {group.summary}
                      </p>
                      {validIndexes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            관련 변경:
                          </span>
                          {validIndexes.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => onFocusHunks([n])}
                              className="inline-flex h-5 items-center rounded border px-1.5 text-xs font-medium tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground"
                              title="해당 변경으로 이동"
                            >
                              #{n + 1}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => onFocusHunks(validIndexes)}
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            모두 보기
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConsentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        providerLabel={
          currentProvider
            ? `${currentProvider.label} · ${currentProvider.model}`
            : "선택된 프로바이더"
        }
        onConfirm={handleConfirm}
      />
    </div>
  );
}
