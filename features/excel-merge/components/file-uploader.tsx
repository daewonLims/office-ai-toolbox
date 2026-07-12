"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MAX_FILES } from "../lib/mapping-schema";
import { parseWorkbook } from "../lib/parse";
import type { ParsedSheet } from "../lib/types";

export interface FailedFile {
  fileName: string;
  error: string;
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_SIZE_LABEL = "20MB";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "파일을 읽을 수 없습니다";
}

export function FileUploader({
  sheets,
  failed,
  onParsed,
  onFailed,
  onRemove,
}: {
  sheets: ParsedSheet[];
  failed: FailedFile[];
  onParsed: (sheet: ParsedSheet) => void;
  onFailed: (item: FailedFile) => void;
  onRemove: (fileName: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const existingNames = new Set([
        ...sheets.map((s) => s.fileName),
        ...failed.map((f) => f.fileName),
      ]);

      const incoming = Array.from(fileList);
      const accepted: File[] = [];

      for (const file of incoming) {
        if (!file.name.toLowerCase().endsWith(".xlsx")) {
          toast.error(`.xlsx 파일만 업로드할 수 있습니다: ${file.name}`);
          continue;
        }
        if (file.size > MAX_SIZE_BYTES) {
          toast.error(
            `파일이 너무 큽니다 (최대 ${MAX_SIZE_LABEL}): ${file.name}`
          );
          continue;
        }
        if (existingNames.has(file.name)) {
          toast.error(`이미 추가된 파일입니다: ${file.name}`);
          continue;
        }
        if (existingNames.size + accepted.length >= MAX_FILES) {
          toast.error(`파일은 최대 ${MAX_FILES}개까지 추가할 수 있습니다`);
          break;
        }
        accepted.push(file);
      }

      if (accepted.length === 0) return;

      setIsParsing(true);
      try {
        for (const file of accepted) {
          try {
            const data = await file.arrayBuffer();
            const sheet = await parseWorkbook(file.name, data);
            onParsed(sheet);
          } catch (err) {
            const message = errorMessage(err);
            onFailed({ fileName: file.name, error: message });
            toast.error(`분석 실패: ${file.name} — ${message}`);
          }
        }
      } finally {
        setIsParsing(false);
      }
    },
    [sheets, failed, onParsed, onFailed]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors outline-none",
          "hover:border-primary/60 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20"
        )}
      >
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {isParsing ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Upload className="size-5" />
          )}
        </div>
        <p className="text-sm font-medium">
          {isParsing
            ? "파일을 분석하고 있습니다…"
            : "엑셀 파일을 여기에 끌어다 놓거나 클릭해 선택하세요"}
        </p>
        <p className="text-xs text-muted-foreground">
          .xlsx · 파일당 최대 {MAX_SIZE_LABEL} · 최대 {MAX_FILES}개
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            // Allow re-selecting the same file after removal.
            e.target.value = "";
          }}
        />
      </div>

      {(sheets.length > 0 || failed.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {sheets.map((sheet) => (
            <Card key={sheet.fileName} size="sm" className="overflow-hidden">
              <CardContent className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <FileSpreadsheet className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={sheet.fileName}>
                    {sheet.fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {sheet.rowCount.toLocaleString()}행 · 컬럼{" "}
                    {sheet.headers.length}개
                  </p>
                  {sheet.headers.length > 0 && (
                    <p
                      className="mt-1 truncate text-xs text-muted-foreground"
                      title={sheet.headers.join(", ")}
                    >
                      {sheet.headers.slice(0, 4).join(" · ")}
                      {sheet.headers.length > 4 ? " …" : ""}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${sheet.fileName} 제거`}
                  onClick={() => onRemove(sheet.fileName)}
                >
                  <X className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}

          {failed.map((item) => (
            <Card
              key={item.fileName}
              size="sm"
              className="overflow-hidden ring-destructive/30"
            >
              <CardContent className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                  <AlertCircle className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium text-destructive"
                    title={item.fileName}
                  >
                    {item.fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-destructive/90">
                    분석 실패 — {item.error}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${item.fileName} 제거`}
                  onClick={() => onRemove(item.fileName)}
                >
                  <X className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
