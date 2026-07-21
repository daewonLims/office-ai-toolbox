"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProvider } from "@/components/provider-select";

import { generateHandover } from "../actions";
import { toMarkdown } from "../lib/markdown";
import { downloadHandoverDocx } from "../lib/docx";
import { DEMO_INPUT } from "../lib/demo";
import {
  BASIC_FIELDS,
  SECTION_FIELDS,
  FIELD_KEYS,
  DEFAULT_INPUT_LIMIT,
  INPUT_LIMIT_OPTIONS,
  INPUT_LIMIT_WARN_AT,
  effectiveInputLimit,
  normalizeInputLimit,
  totalLength,
  type FieldKey,
  type HandoverResponse,
  type MissingPriority,
} from "../lib/schema";
import { ConsentDialog } from "./consent-dialog";

const CONSENT_KEY = "office-ai-toolbox:handover-consent";
const LIMIT_KEY = "office-ai-toolbox:handover-input-limit";

function readStoredLimit(): number {
  if (typeof window === "undefined") return DEFAULT_INPUT_LIMIT;
  try {
    const raw = window.localStorage.getItem(LIMIT_KEY);
    return raw !== null ? normalizeInputLimit(raw) : DEFAULT_INPUT_LIMIT;
  } catch {
    return DEFAULT_INPUT_LIMIT;
  }
}

let currentLimit: number | undefined; // undefined = not yet initialized

function getLimitSnapshot(): number {
  if (currentLimit === undefined) currentLimit = readStoredLimit();
  return currentLimit;
}

const limitListeners = new Set<() => void>();

function subscribeLimit(cb: () => void): () => void {
  limitListeners.add(cb);
  return () => limitListeners.delete(cb);
}

function writeStoredLimit(n: number): void {
  currentLimit = n;
  try {
    window.localStorage.setItem(LIMIT_KEY, String(n));
  } catch {
    // 저장 실패는 무시(프라이빗 모드 등)
  }
  limitListeners.forEach((l) => l());
}

type FormValues = Record<FieldKey, string>;

const EMPTY_FORM: FormValues = {
  deptRole: "",
  reason: "",
  targetDate: "",
  overview: "",
  ongoing: "",
  recurring: "",
  stakeholders: "",
  systems: "",
  resources: "",
  etc: "",
};

const PRIORITY_META: Record<
  MissingPriority,
  { label: string; className: string }
> = {
  high: {
    label: "높음",
    className:
      "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  },
  medium: {
    label: "중간",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  low: {
    label: "낮음",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
};

const PRIORITY_ORDER: Record<MissingPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
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

const INPUT_CLASS = cn(
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm",
  "outline-none transition-colors placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
);

export function HandoverGenerator() {
  const { providerId, providers } = useProvider();

  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<HandoverResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const inputLimit = useSyncExternalStore(
    subscribeLimit,
    getLimitSnapshot,
    () => DEFAULT_INPUT_LIMIT
  );

  const handleLimitChange = (value: string | null) => {
    writeStoredLimit(normalizeInputLimit(value));
  };

  const charCount = totalLength(form);
  const effectiveLimit = effectiveInputLimit(inputLimit);
  const overLimit = charCount > effectiveLimit;
  const showLimitWarning = inputLimit >= INPUT_LIMIT_WARN_AT;
  const isEmpty = FIELD_KEYS.every((k) => form[k].trim().length === 0);

  const currentProvider = providers.find((p) => p.id === providerId) ?? null;
  const hasProvider = providers.some((p) => p.available) && providerId !== null;
  const canGenerate = hasProvider && !isEmpty && !overLimit && !isLoading;

  const sortedMissing = useMemo(() => {
    if (!result) return [];
    return [...result.missingInfo].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );
  }, [result]);

  const setField = (key: FieldKey, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fillDemo = () => setForm({ ...DEMO_INPUT });
  const clearForm = () => {
    setForm(EMPTY_FORM);
    setResult(null);
  };

  const doGenerate = async () => {
    if (!providerId || isEmpty || overLimit) return;
    setIsLoading(true);
    setResult(null);
    try {
      const res = await generateHandover({ providerId, inputLimit, ...form });
      if (res.ok) {
        setResult(res.data);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateClick = () => {
    if (!canGenerate) return;
    if (readConsent()) {
      void doGenerate();
    } else {
      setDialogOpen(true);
    }
  };

  const handleConfirm = (dontShowAgain: boolean) => {
    if (dontShowAgain) saveConsent();
    setDialogOpen(false);
    void doGenerate();
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(result));
      toast.success("인수인계서를 마크다운으로 복사했습니다.");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사에 실패했습니다. 직접 선택해 복사해 주세요.");
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      await downloadHandoverDocx(result);
    } catch {
      toast.error("Word 문서 생성에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* 입력 폼 */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fillDemo}>
                <Wand2 />
                예시 입력 채우기
              </Button>
              {!isEmpty && (
                <Button variant="ghost" size="sm" onClick={clearForm}>
                  비우기
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="handover-input-limit"
                  className="text-xs text-muted-foreground"
                >
                  입력 상한
                </label>
                <Select
                  value={String(inputLimit)}
                  onValueChange={handleLimitChange}
                >
                  <SelectTrigger id="handover-input-limit" size="sm" className="w-28">
                    <SelectValue>
                      {(v: string | null) =>
                        v ? `${Number(v).toLocaleString()}자` : ""
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {INPUT_LIMIT_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n.toLocaleString()}자
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  overLimit
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
                )}
              >
                {charCount.toLocaleString()} / {effectiveLimit.toLocaleString()}자
              </span>
            </div>
          </div>
          {showLimitWarning && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <span>
                입력이 길수록 AI 응답 시간과 비용이 늘어나고, 생성 문서가 길어져
                잘릴 가능성이 커집니다. 꼭 필요한 내용 위주로 입력하는 것을
                권장합니다.
              </span>
            </p>
          )}
        </div>

        {/* 기본 정보 (짧은 input) */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">기본 정보</span>
          <div className="grid gap-3 sm:grid-cols-3">
            {BASIC_FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label htmlFor={`hf-${f.key}`} className="text-xs text-muted-foreground">
                  {f.label}
                </label>
                <input
                  id={`hf-${f.key}`}
                  type="text"
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 서술형 섹션 (textarea) */}
        <div className="grid gap-4 md:grid-cols-2">
          {SECTION_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label htmlFor={`hf-${f.key}`} className="text-sm font-medium">
                {f.label}
              </label>
              <Textarea
                id={`hf-${f.key}`}
                value={form[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="min-h-32"
              />
              {f.warning && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  ⚠ {f.warning}
                </p>
              )}
            </div>
          ))}
        </div>

        {overLimit && (
          <p className="text-xs text-destructive">
            전체 입력은 선택한 상한({effectiveLimit.toLocaleString()}자)까지 가능합니다.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleGenerateClick} disabled={!canGenerate}>
            {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            인수인계서 생성
          </Button>
          {isEmpty && (
            <span className="text-xs text-muted-foreground">
              최소 한 개 항목을 입력하세요.
            </span>
          )}
          {!hasProvider && (
            <span className="text-xs text-muted-foreground">
              AI 모델이 설정되지 않았습니다. 좌측 하단에서 프로바이더를
              선택하거나 .env.local에 API 키를 추가하세요.
            </span>
          )}
        </div>
      </div>

      {/* 결과 */}
      {result && (
        <div className="flex flex-col gap-4 border-t pt-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            {/* 왼쪽: 생성된 인수인계서 */}
            <Card className="min-w-0">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="size-4 text-primary" />
                    {result.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      aria-label="마크다운으로 복사"
                    >
                      {copied ? (
                        <Check className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy />
                      )}
                      복사
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      disabled={downloading}
                      aria-label="Word 문서 다운로드"
                    >
                      {downloading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Download />
                      )}
                      .docx
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {result.sections.map((section, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <h3 className="text-sm font-semibold">{section.heading}</h3>
                    <ul className="flex flex-col gap-1">
                      {section.items.map((item, j) => (
                        <li
                          key={j}
                          className="flex gap-2 text-sm leading-relaxed"
                        >
                          <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                          <span className="break-words">
                            {item.label && (
                              <span className="font-medium">{item.label}: </span>
                            )}
                            {item.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {result.notes && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    참고: {result.notes}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 오른쪽: 보완이 필요한 정보 체크리스트 */}
            <Card className="min-w-0 self-start border-amber-300/60 dark:border-amber-800/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span aria-hidden>📋</span>
                  보완이 필요한 정보
                  <Badge variant="secondary" className="ml-auto">
                    {sortedMissing.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sortedMissing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    특별히 보완할 정보가 확인되지 않았습니다.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {sortedMissing.map((m, i) => {
                      const meta = PRIORITY_META[m.priority];
                      return (
                        <li key={i} className="flex flex-col gap-1">
                          <div className="flex items-start gap-2">
                            <Badge
                              className={cn(
                                "mt-0.5 shrink-0 border-transparent px-1.5 py-0 text-[11px] font-medium",
                                meta.className
                              )}
                            >
                              {meta.label}
                            </Badge>
                            <span className="text-sm font-medium break-words">
                              {m.question}
                            </span>
                          </div>
                          <p className="pl-1 text-xs text-muted-foreground break-words">
                            {m.why}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={handleGenerateClick}
              disabled={!canGenerate}
            >
              <RotateCcw />
              다시 생성
            </Button>
          </div>
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
