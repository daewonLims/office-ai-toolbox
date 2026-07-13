"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useProvider } from "@/components/provider-select";
import type { PresentationModel, Violation } from "../lib/types";
import { buildSummaryRequest } from "../lib/report";
import { generateImprovementReport } from "../actions";
import type { Priority, SummaryResponse } from "../lib/summary-schema";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

function priorityClasses(priority: Priority): string {
  switch (priority) {
    case "high":
      return "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
    case "low":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  }
}

export function AiSummary({
  model,
  violations,
}: {
  model: PresentationModel;
  violations: Violation[];
}) {
  const { providerId, providers } = useProvider();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SummaryResponse | null>(null);

  const hasProvider = providers.some((p) => p.available) && providerId !== null;

  const handleClick = async () => {
    if (!providerId) return;
    setIsLoading(true);
    setResult(null);
    try {
      const req = buildSummaryRequest(providerId, model, violations);
      const res = await generateImprovementReport(req);
      if (res.ok) {
        setResult(res.data);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("AI 개선 리포트 생성에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleClick} disabled={isLoading || !hasProvider}>
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          AI 개선 리포트
        </Button>
        <span className="text-xs text-muted-foreground">
          스타일 정보(글꼴·색상·위반 통계)만 전송됩니다
        </span>
      </div>

      {!hasProvider && (
        <p className="text-xs text-muted-foreground">
          AI 모델이 설정되지 않았습니다. 좌측 하단에서 프로바이더를 선택하거나
          .env.local에 API 키를 추가하세요.
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4 text-primary" />
                AI 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{result.summary}</p>
            </CardContent>
          </Card>

          {result.recommendations.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {result.recommendations.map((rec, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-2 text-sm">
                      <span>{rec.title}</span>
                      <span
                        className={cn(
                          "inline-flex h-5 shrink-0 items-center rounded-4xl px-2 py-0.5 text-xs font-medium",
                          priorityClasses(rec.priority)
                        )}
                      >
                        {PRIORITY_LABEL[rec.priority]}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
