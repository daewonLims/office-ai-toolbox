"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useProvider } from "@/components/provider-select";

import { convertText } from "../actions";
import { assembleText } from "../lib/markers";
import {
  MAX_TEXT_LEN,
  type ConvertResponse,
  type Direction,
  type Preset,
} from "../lib/schema";
import { ConsentDialog } from "./consent-dialog";

const CONSENT_KEY = "office-ai-toolbox:report-style-consent";

const DIRECTION_OPTIONS: { value: Direction; label: string; hint: string }[] = [
  { value: "to-outline", label: "서술식 → 개조식", hint: "줄글을 보고서용 개조식으로" },
  { value: "to-prose", label: "개조식 → 서술식", hint: "개요·불릿을 줄글 문장으로" },
];

const PRESET_OPTIONS: { value: Preset; label: string; hint: string }[] = [
  { value: "public", label: "공공기관형", hint: "□ ○ - 기호 · ~함/~임/~됨" },
  { value: "corporate", label: "기업 보고형", hint: "1. 1) - 번호 · 간결 명사형" },
  { value: "meeting", label: "회의록형", hint: "- 불릿 · 결정/조치 구분" },
];

interface ResultSnapshot {
  source: string;
  direction: Direction;
  preset: Preset;
  response: ConvertResponse;
}

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

export function OutlineConverter() {
  const { providerId, providers } = useProvider();

  const [text, setText] = useState("");
  const [direction, setDirection] = useState<Direction>("to-outline");
  const [preset, setPreset] = useState<Preset>("public");

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResultSnapshot | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const charCount = text.length;
  const overLimit = charCount > MAX_TEXT_LEN;
  const isEmpty = text.trim().length === 0;

  const currentProvider = providers.find((p) => p.id === providerId) ?? null;
  const hasProvider =
    providers.some((p) => p.available) && providerId !== null;

  const canConvert = hasProvider && !isEmpty && !overLimit && !isLoading;

  const outputText = useMemo(() => {
    if (!result) return "";
    return assembleText(
      result.response.lines,
      result.direction,
      result.preset
    );
  }, [result]);

  const doConvert = async () => {
    if (!providerId || isEmpty || overLimit) return;
    setIsLoading(true);
    setResult(null);
    const snapSource = text;
    const snapDirection = direction;
    const snapPreset = preset;
    try {
      const res = await convertText({
        providerId,
        text: snapSource,
        direction: snapDirection,
        preset: snapPreset,
      });
      if (res.ok) {
        setResult({
          source: snapSource,
          direction: snapDirection,
          preset: snapPreset,
          response: res.data,
        });
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("변환에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvertClick = () => {
    if (!canConvert) return;
    if (readConsent()) {
      void doConvert();
    } else {
      setDialogOpen(true);
    }
  };

  const handleConfirm = (dontShowAgain: boolean) => {
    if (dontShowAgain) saveConsent();
    setDialogOpen(false);
    void doConvert();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
      toast.success("결과를 클립보드에 복사했습니다.");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사에 실패했습니다. 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* 입력 + 옵션 */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="outline-input"
              className="text-sm font-medium"
            >
              원문 텍스트
            </label>
            <span
              className={cn(
                "text-xs tabular-nums",
                overLimit ? "text-destructive font-medium" : "text-muted-foreground"
              )}
            >
              {charCount.toLocaleString()} / {MAX_TEXT_LEN.toLocaleString()}자
            </span>
          </div>
          <Textarea
            id="outline-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="변환할 텍스트를 붙여넣으세요."
            className="min-h-40"
            aria-invalid={overLimit}
          />
          {overLimit && (
            <p className="text-xs text-destructive">
              최대 {MAX_TEXT_LEN.toLocaleString()}자까지 변환할 수 있습니다.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">변환 방향</span>
            <RadioGroup
              value={direction}
              onValueChange={(v) => setDirection(v as Direction)}
            >
              {DIRECTION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-2 text-sm"
                >
                  <RadioGroupItem value={opt.value} className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {opt.hint}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {direction === "to-outline" && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">문체 프리셋</span>
              <RadioGroup
                value={preset}
                onValueChange={(v) => setPreset(v as Preset)}
              >
                {PRESET_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-start gap-2 text-sm"
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <span className="flex flex-col">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleConvertClick} disabled={!canConvert}>
            {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            변환하기
          </Button>
          {!hasProvider && (
            <span className="text-xs text-muted-foreground">
              AI 모델이 설정되지 않았습니다. 좌측 하단에서 프로바이더를
              선택하거나 .env.local에 API 키를 추가하세요.
            </span>
          )}
        </div>
      </div>

      {/* 결과: 원문(왼쪽) / 결과(오른쪽) */}
      {result && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  원문
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                  {result.source}
                </pre>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="size-4 text-primary" />
                    변환 결과
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    aria-label="변환 결과 복사"
                  >
                    {copied ? (
                      <Check className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy />
                    )}
                    복사
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                  {outputText}
                </pre>
              </CardContent>
            </Card>
          </div>

          {result.response.notes && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              유의점: {result.response.notes}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={handleConvertClick}
              disabled={!canConvert}
            >
              <RotateCcw />
              다시 변환
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
