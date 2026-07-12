"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  MAX_UNIQUE_VALUES,
  MAX_VALUE_LEN,
  type Confidence,
} from "../lib/mapping-schema";
import type { CellValue, ParsedSheet } from "../lib/types";
import { suggestValueUnification } from "../actions";
import type { ReviewFile } from "./mapping-review";

const NONE = "__none__";

interface EditableSuggestion {
  from: string;
  to: string;
  confidence: Confidence;
  apply: boolean;
}

const confidenceLabel: Record<Confidence, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

/** CellValue → 비교/전송용 문자열 (빈값은 null, 100자 캡) */
function cellToStr(v: CellValue): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === "number" ? String(v) : String(v).trim();
  if (s === "") return null;
  return s.length > MAX_VALUE_LEN ? s.slice(0, MAX_VALUE_LEN) : s;
}

function uniqueOfColumn(sheet: ParsedSheet, colIndex: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of sheet.rows) {
    const s = cellToStr(row[colIndex] ?? null);
    if (s === null || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function ValueUnification({
  baseSheet,
  sourceSheets,
  review,
  providerId,
  applied,
  onApply,
  onClear,
}: {
  baseSheet: ParsedSheet;
  sourceSheets: ParsedSheet[];
  review: ReviewFile[];
  providerId: string | null;
  applied: Record<string, Record<string, string>>;
  onApply: (targetColumn: string, map: Record<string, string>) => void;
  onClear: (targetColumn: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<EditableSuggestion[] | null>(null);
  const [isSuggesting, startSuggest] = useTransition();

  const targetColumns = baseSheet.headers;

  /** 선택 컬럼의 파일별 고유값 수집 */
  const collect = useMemo(() => {
    return (target: string) => {
      const baseIdx = baseSheet.headers.indexOf(target);
      const baseValues = baseIdx >= 0 ? uniqueOfColumn(baseSheet, baseIdx) : [];
      const sources: { fileName: string; values: string[] }[] = [];
      for (const src of sourceSheets) {
        const rf = review.find((f) => f.fileName === src.fileName);
        if (!rf || rf.excluded) continue;
        const rowMap = rf.rows.find((r) => r.targetColumn === target);
        const sc = rowMap?.sourceColumn ?? null;
        if (!sc) continue;
        const idx = src.headers.indexOf(sc);
        if (idx < 0) continue;
        const values = uniqueOfColumn(src, idx);
        if (values.length > 0) sources.push({ fileName: src.fileName, values });
      }
      const union = new Set<string>(baseValues);
      for (const s of sources) for (const v of s.values) union.add(v);
      return { baseValues, sources, unionSize: union.size };
    };
  }, [baseSheet, sourceSheets, review]);

  const handleSelect = (value: string | null) => {
    setSelected(value == null || value === NONE ? null : value);
    setSuggestions(null);
  };

  const handleSuggest = () => {
    if (!selected) return;
    if (!providerId) {
      toast.error("먼저 왼쪽 사이드바에서 AI 모델을 설정하세요.");
      return;
    }
    const { baseValues, sources, unionSize } = collect(selected);
    if (unionSize === 0) {
      toast.error("이 컬럼에서 통일할 값을 찾지 못했습니다.");
      return;
    }
    if (unionSize > MAX_UNIQUE_VALUES) {
      toast.error(
        `값 종류가 너무 많아 통일 제안을 사용할 수 없습니다 (고유값 ${unionSize}개). 범주형 컬럼에만 사용하세요.`
      );
      return;
    }

    startSuggest(async () => {
      const result = await suggestValueUnification({
        providerId: providerId as "anthropic" | "openai" | "gemini",
        columnName: selected,
        baseValues,
        sources,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const editable: EditableSuggestion[] = result.data.mappings.map((m) => ({
        from: m.from,
        to: m.to,
        confidence: m.confidence,
        apply: m.to.trim() !== "" && m.to.trim() !== m.from, // 실제 변경만 기본 체크
      }));
      if (editable.length === 0) {
        toast.info("AI가 통일할 값을 찾지 못했습니다.");
      }
      setSuggestions(editable);
    });
  };

  const updateSuggestion = (index: number, patch: Partial<EditableSuggestion>) => {
    setSuggestions((prev) =>
      prev ? prev.map((s, i) => (i === index ? { ...s, ...patch } : s)) : prev
    );
  };

  const handleApply = () => {
    if (!selected || !suggestions) return;
    const map: Record<string, string> = {};
    for (const s of suggestions) {
      const to = s.to.trim();
      if (s.apply && to !== "" && to !== s.from) {
        map[s.from] = to;
      }
    }
    if (Object.keys(map).length === 0) {
      toast.error("적용할 변경이 없습니다.");
      return;
    }
    onApply(selected, map);
    toast.success(`"${selected}" 컬럼에 ${Object.keys(map).length}건의 값 통일을 적용했습니다.`);
  };

  const appliedForSelected = selected ? applied[selected] : undefined;
  const appliedCount = appliedForSelected ? Object.keys(appliedForSelected).length : 0;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="size-4" />
          값 통일 (선택)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          같은 의미인데 파일마다 다르게 적힌 값(예: &quot;Sales&quot; / &quot;영업1팀&quot;)을 하나로
          통일합니다.
        </p>

        <Alert>
          <Sparkles />
          <AlertTitle>전송되는 정보 안내</AlertTitle>
          <AlertDescription>
            이 기능을 사용하면 선택한 컬럼의 고유값 목록이 AI에 전송됩니다. (원본 전체
            데이터는 전송되지 않습니다.)
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">기준 컬럼</span>
            <Select value={selected ?? NONE} onValueChange={handleSelect}>
              <SelectTrigger className="w-full min-w-52">
                <SelectValue placeholder="컬럼 선택">
                  {(v: string | null) =>
                    v == null || v === NONE ? "컬럼 선택" : v
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  <span className="text-muted-foreground">컬럼 선택</span>
                </SelectItem>
                {targetColumns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSuggest}
            disabled={!selected || !providerId || isSuggesting}
          >
            {isSuggesting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            AI로 값 통일 제안 받기
          </Button>
        </div>

        {appliedCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <span>
              &quot;{selected}&quot; 컬럼에 {appliedCount}건의 값 통일이 적용되어 있습니다.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selected && onClear(selected)}
            >
              <X className="size-4" />
              해제
            </Button>
          </div>
        )}

        {suggestions && suggestions.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-12 px-3 py-2 text-left font-medium">적용</th>
                    <th className="px-3 py-2 text-left font-medium">원래 값</th>
                    <th className="px-3 py-2 text-left font-medium">통일 값</th>
                    <th className="px-3 py-2 text-left font-medium">확신도</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s, i) => (
                    <tr
                      key={`${s.from}-${i}`}
                      className={cn("border-t", !s.apply && "opacity-60")}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={s.apply}
                          onChange={(e) =>
                            updateSuggestion(i, { apply: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{s.from}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          className="w-full min-w-40 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                          value={s.to}
                          maxLength={MAX_VALUE_LEN}
                          onChange={(e) =>
                            updateSuggestion(i, { to: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {confidenceLabel[s.confidence]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <Button onClick={handleApply} variant="secondary">
                <Wand2 className="size-4" />
                선택 항목 적용
              </Button>
            </div>
          </div>
        )}

        {suggestions && suggestions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            AI가 통일이 필요한 값을 찾지 못했습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
