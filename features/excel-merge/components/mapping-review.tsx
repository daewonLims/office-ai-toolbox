"use client";

import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Confidence, TransformKind } from "../lib/mapping-schema";
import type { ParsedSheet } from "../lib/types";

// Sentinel for the "매핑 안 함" option — Radix/Base UI Select cannot use an
// empty-string item value. Converted to/from `null` at the component boundary.
const NONE = "__none__";

export interface ReviewRow {
  targetColumn: string;
  sourceColumn: string | null;
  confidence: Confidence;
  transformKind: TransformKind;
  dateSourceFormat: string | null;
  transform: string | null;
}

export interface ReviewFile {
  fileName: string;
  excluded: boolean;
  notes: string | null;
  rows: ReviewRow[];
}

const confidenceLabel: Record<Confidence, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const transformLabel: Partial<Record<TransformKind, string>> = {
  date: "날짜 변환",
  phone: "전화번호 정리",
  other: "형식 변환",
};

function TransformBadge({ kind }: { kind: TransformKind }) {
  const label = transformLabel[kind];
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center rounded-4xl px-2 py-0.5 text-xs font-medium",
        kind === "date" &&
          "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
        kind === "phone" &&
          "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
        kind === "other" &&
          "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
      )}
    >
      {label}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center rounded-4xl px-2 py-0.5 text-xs font-medium",
        confidence === "high" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
        confidence === "medium" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
        confidence === "low" &&
          "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
      )}
    >
      {confidenceLabel[confidence]}
    </span>
  );
}

export function MappingReview({
  sources,
  review,
  onChangeSource,
  onToggleExclude,
}: {
  sources: ParsedSheet[];
  review: ReviewFile[];
  onChangeSource: (
    fileName: string,
    targetColumn: string,
    sourceColumn: string | null
  ) => void;
  onToggleExclude: (fileName: string, excluded: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {review.map((file) => {
        const source = sources.find((s) => s.fileName === file.fileName);
        const headers = source?.headers ?? [];
        return (
          <Card key={file.fileName} className={cn(file.excluded && "opacity-60")}>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle
                  className="truncate"
                  title={file.fileName}
                >
                  {file.fileName}
                </CardTitle>
                <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                  이 파일 제외
                  <Switch
                    checked={file.excluded}
                    onCheckedChange={(checked) =>
                      onToggleExclude(file.fileName, checked)
                    }
                  />
                </label>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              {file.notes && (
                <Alert>
                  <Info />
                  <AlertTitle>AI 참고사항</AlertTitle>
                  <AlertDescription>{file.notes}</AlertDescription>
                </Alert>
              )}

              <div
                className={cn(
                  file.excluded && "pointer-events-none select-none"
                )}
                aria-disabled={file.excluded}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>기준 컬럼</TableHead>
                      <TableHead>소스 컬럼</TableHead>
                      <TableHead>확신도</TableHead>
                      <TableHead>형식 메모</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {file.rows.map((row) => {
                      const prominent =
                        row.confidence === "low" ||
                        row.confidence === "medium";
                      return (
                        <TableRow
                          key={row.targetColumn}
                          className={cn(
                            "border-l-2 border-l-transparent",
                            row.confidence === "medium" &&
                              "border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
                            row.confidence === "low" &&
                              "border-l-rose-400 bg-rose-50/50 dark:bg-rose-950/20"
                          )}
                        >
                          <TableCell
                            className={cn(
                              "font-medium",
                              prominent && "text-foreground"
                            )}
                          >
                            {row.targetColumn}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row.sourceColumn ?? NONE}
                              onValueChange={(next) =>
                                onChangeSource(
                                  file.fileName,
                                  row.targetColumn,
                                  next === NONE ? null : (next as string)
                                )
                              }
                              disabled={file.excluded}
                            >
                              <SelectTrigger className="w-full min-w-40">
                                <SelectValue placeholder="매핑 안 함">
                                  {(v: string | null) =>
                                    v == null || v === NONE
                                      ? "매핑 안 함"
                                      : v
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>
                                  <span className="text-muted-foreground">
                                    매핑 안 함
                                  </span>
                                </SelectItem>
                                {headers.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <ConfidenceBadge confidence={row.confidence} />
                          </TableCell>
                          <TableCell className="max-w-52 whitespace-normal text-xs text-muted-foreground">
                            <div className="flex flex-col gap-1">
                              {row.transformKind !== "none" && (
                                <TransformBadge kind={row.transformKind} />
                              )}
                              <span>
                                {row.transform ??
                                  (row.transformKind === "date" &&
                                  row.dateSourceFormat
                                    ? `${row.dateSourceFormat} → YYYY-MM-DD`
                                    : "—")}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {file.rows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-sm text-muted-foreground"
                        >
                          매핑할 컬럼이 없습니다
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
