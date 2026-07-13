"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "../lib/constants";
import { parsePptx } from "../lib/parse";
import { SafeZipError } from "../lib/safe-zip";
import type { PresentationModel } from "../lib/types";

function errorMessage(err: unknown): string {
  if (err instanceof SafeZipError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "파일을 분석할 수 없습니다.";
}

export function FileUploader({
  fileName,
  onParsed,
}: {
  fileName: string | null;
  onParsed: (fileName: string, model: PresentationModel) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);

      if (!file.name.toLowerCase().endsWith(".pptx")) {
        const msg = ".pptx 파일만 업로드할 수 있습니다.";
        setError(msg);
        toast.error(msg);
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        const msg = `파일이 너무 큽니다 (최대 ${MAX_UPLOAD_LABEL}).`;
        setError(msg);
        toast.error(msg);
        return;
      }

      setIsParsing(true);
      try {
        const buffer = await file.arrayBuffer();
        const model = await parsePptx(buffer);
        onParsed(file.name, model);
      } catch (err) {
        const msg = errorMessage(err);
        setError(msg);
        toast.error(`분석 실패 — ${msg}`);
      } finally {
        setIsParsing(false);
      }
    },
    [onParsed]
  );

  return (
    <div className="flex flex-col gap-3">
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
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors outline-none",
          "hover:border-primary/60 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/20"
        )}
      >
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {isParsing ? (
            <Loader2 className="size-5 animate-spin" />
          ) : fileName ? (
            <FileText className="size-5" />
          ) : (
            <Upload className="size-5" />
          )}
        </div>
        <p className="text-sm font-medium">
          {isParsing
            ? "브라우저에서 파일을 분석하고 있습니다…"
            : fileName
              ? `${fileName} — 다른 파일로 교체하려면 클릭하세요`
              : "발표 자료(.pptx)를 여기에 끌어다 놓거나 클릭해 선택하세요"}
        </p>
        <p className="text-xs text-muted-foreground">
          .pptx · 최대 {MAX_UPLOAD_LABEL} · 파일은 브라우저 안에서만 분석됩니다
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pptx"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
