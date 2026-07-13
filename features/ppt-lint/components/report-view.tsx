"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, TriangleAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PresentationModel, Severity, Violation } from "../lib/types";
import { computeBaseline } from "../lib/baseline";
import { computeStats } from "../lib/report";
import { RULE_LABELS } from "../lib/rules";

const SEVERITY_LABEL: Record<Severity, string> = {
  error: "오류",
  warning: "경고",
  info: "정보",
};

// 심각도 배지: 엑셀 취합의 confidence 배지와 같은 문법(초록/노랑/빨강)
function severityClasses(severity: Severity): string {
  switch (severity) {
    case "error":
      return "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
    case "info":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  }
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center rounded-4xl px-2 py-0.5 text-xs font-medium",
        severityClasses(severity)
      )}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const SEVERITY_ICON: Record<Severity, ReactNode> = {
  error: <CircleAlert className="size-4 text-rose-600 dark:text-rose-400" />,
  warning: <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />,
  info: <Info className="size-4 text-emerald-600 dark:text-emerald-400" />,
};

function ViolationRow({ v }: { v: Violation }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 shrink-0">{SEVERITY_ICON[v.severity]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={v.severity} />
          <span className="text-xs text-muted-foreground">
            {RULE_LABELS[v.ruleId] ?? v.ruleId}
          </span>
        </div>
        <p className="mt-1 text-sm">{v.message}</p>
        {v.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground">{v.detail}</p>
        )}
      </div>
    </li>
  );
}

export function ReportView({
  model,
  violations,
}: {
  model: PresentationModel;
  violations: Violation[];
}) {
  const [groupBy, setGroupBy] = useState<"slide" | "rule">("slide");
  const stats = useMemo(() => computeStats(model, violations), [model, violations]);
  const baseline = useMemo(() => computeBaseline(model), [model]);

  const grouped = useMemo(() => {
    const map = new Map<string, Violation[]>();
    for (const v of violations) {
      const key =
        groupBy === "slide"
          ? `슬라이드 ${v.slideNumber}`
          : RULE_LABELS[v.ruleId] ?? v.ruleId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return [...map.entries()];
  }, [violations, groupBy]);

  return (
    <div className="flex flex-col gap-6">
      {/* 요약 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">전체 위반</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalViolations}</div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                {SEVERITY_ICON.error} 오류 {stats.severityCounts.error}
              </span>
              <span className="inline-flex items-center gap-1">
                {SEVERITY_ICON.warning} 경고 {stats.severityCounts.warning}
              </span>
              <span className="inline-flex items-center gap-1">
                {SEVERITY_ICON.info} 정보 {stats.severityCounts.info}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">기준 글꼴</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="truncate text-xl font-semibold" title={baseline.font ?? ""}>
              {baseline.font ?? "판단 불가"}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              테마 지정 글꼴: {baseline.themeMajorFont ?? "없음"}
            </p>
            {baseline.fontCounts.length > 0 && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                사용 글꼴 {baseline.fontCounts.length}종:{" "}
                {baseline.fontCounts.map((f) => f.name).join(" · ")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">기준 팔레트</CardTitle>
          </CardHeader>
          <CardContent>
            {baseline.palette.length === 0 ? (
              <p className="text-sm text-muted-foreground">감지된 색상 없음</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {baseline.palette.map((hex) => (
                  <span key={hex} className="inline-flex items-center gap-1.5 text-xs">
                    <span
                      className="inline-block size-4 rounded border border-border"
                      style={{ backgroundColor: `#${hex}` }}
                    />
                    #{hex}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              슬라이드 {stats.totalSlides}개 분석됨
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 위반 목록 또는 축하 메시지 */}
      {violations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-10 text-emerald-500" />
            <p className="text-lg font-semibold">서식 위반이 발견되지 않았습니다 🎉</p>
            <p className="text-sm text-muted-foreground">
              글꼴·색상·정렬·바닥글이 모두 일관됩니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">위반 상세</h2>
            <div className="inline-flex rounded-md border p-0.5 text-sm">
              {(["slide", "rule"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGroupBy(mode)}
                  className={cn(
                    "rounded px-3 py-1 transition-colors",
                    groupBy === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {mode === "slide" ? "슬라이드별" : "규칙별"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {grouped.map(([groupKey, items]) => (
              <Card key={groupKey} className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span>{groupKey}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {items.length}건
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {items.map((v, i) => (
                      <ViolationRow key={`${v.ruleId}-${v.slideNumber}-${i}`} v={v} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
