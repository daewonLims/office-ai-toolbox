"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/safe-zip";
import { extractDocxParagraphs, SafeZipError } from "../lib/docx";
import { MAX_DOC_LEN } from "../lib/schema";

export type SourceMode = "paste" | "upload";

function errorMessage(err: unknown): string {
  if (err instanceof SafeZipError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "파일을 분석할 수 없습니다.";
}

const MODE_TABS: { value: SourceMode; label: string }[] = [
  { value: "paste", label: "붙여넣기" },
  { value: "upload", label: ".docx 업로드" },
];

export function SourcePanel({
  label,
  badge,
  mode,
  onModeChange,
  text,
  onTextChange,
  fileName,
  onFile,
}: {
  label: string;
  badge: string;
  mode: SourceMode;
  onModeChange: (mode: SourceMode) => void;
  text: string;
  onTextChange: (text: string) => void;
  fileName: string | null;
  /** 업로드·추출 완료 시(파일명, 추출 텍스트) */
  onFile: (fileName: string, text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = text.length;
  const overLimit = charCount > MAX_DOC_LEN;

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);

      if (!file.name.toLowerCase().endsWith(".docx")) {
        const msg = ".docx 파일만 업로드할 수 있습니다.";
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
        const paras = await extractDocxParagraphs(buffer);
        if (paras.length === 0) {
          const msg = "문서에서 텍스트를 찾지 못했습니다.";
          setError(msg);
          toast.error(msg);
          return;
        }
        // 각 문단을 한 줄로(내부 줄바꿈은 공백으로) 이어붙여 붙여넣기와 형식을 통일.
        const joined = paras.map((p) => p.replace(/\n/g, " ")).join("\n");
        onFile(file.name, joined);
        if (joined.length > MAX_DOC_LEN) {
          toast.warning(
            `문서가 ${MAX_DOC_LEN.toLocaleString()}자를 초과했습니다. 초과분을 줄여 비교하세요.`
          );
        }
      } catch (err) {
        const msg = errorMessage(err);
        setError(msg);
        toast.error(`분석 실패 — ${msg}`);
      } finally {
        setIsParsing(false);
      }
    },
    [onFile]
  );

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
            {badge}
          </span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="inline-flex rounded-md border p-0.5">
          {MODE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onModeChange(tab.value)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                mode === tab.value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "paste" ? (
        <Textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="문서 내용을 붙여넣으세요. (한 줄 = 한 문단으로 비교)"
          className="min-h-52"
          aria-invalid={overLimit}
        />
      ) : (
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
            "flex min-h-52 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors outline-none",
            "hover:border-primary/60 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/20"
          )}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {isParsing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : fileName ? (
              <FileText className="size-5" />
            ) : (
              <Upload className="size-5" />
            )}
          </div>
          <p className="text-sm font-medium break-all">
            {isParsing
              ? "브라우저에서 분석 중…"
              : fileName
                ? `${fileName} — 교체하려면 클릭`
                : ".docx 파일을 끌어다 놓거나 클릭해 선택"}
          </p>
          <p className="text-xs text-muted-foreground">
            .docx · 최대 {MAX_UPLOAD_LABEL} · 파일은 브라우저 안에서만 분석됩니다
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-xs tabular-nums",
            overLimit ? "text-destructive font-medium" : "text-muted-foreground"
          )}
        >
          {charCount.toLocaleString()} / {MAX_DOC_LEN.toLocaleString()}자
        </span>
        {overLimit && (
          <span className="text-xs text-destructive">
            상한을 초과했습니다.
          </span>
        )}
      </div>

      {error && mode === "upload" && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
    </div>
  );
}
