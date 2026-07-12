"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProvider } from "@/components/provider-select";
import { cn } from "@/lib/utils";

import type { MappingResponse, Confidence } from "../lib/mapping-schema";
import { toFileMeta } from "../lib/parse";
import type { ParsedSheet } from "../lib/types";
import { mergeSheets, type ConfirmedFileMapping } from "../lib/merge";
import { downloadMergedWorkbook } from "../lib/download";
import { runColumnMapping } from "../actions";

import { FileUploader, type FailedFile } from "./file-uploader";
import { BaseFormSelect } from "./base-form-select";
import {
  MappingReview,
  type ReviewFile,
  type ReviewRow,
} from "./mapping-review";
import { ValueUnification } from "./value-unification";
import { StepIndicator, type StepInfo } from "./step-indicator";

const STEPS: StepInfo[] = [
  { id: 1, label: "업로드" },
  { id: 2, label: "기준 파일" },
  { id: 3, label: "AI 매핑" },
  { id: 4, label: "매핑 검토" },
  { id: 5, label: "취합·다운로드" },
];

/** Build the editable review state from the AI response + base headers. */
function buildReview(
  response: MappingResponse,
  baseHeaders: string[],
  sources: ParsedSheet[]
): ReviewFile[] {
  return sources.map((source) => {
    const aiFile = response.files.find(
      (f) => f.fileName === source.fileName
    );
    const rows: ReviewRow[] = baseHeaders.map((target) => {
      const aiRow = aiFile?.mappings.find((m) => m.targetColumn === target);
      // Only trust source columns that actually exist in the source file.
      const sourceColumn =
        aiRow && aiRow.sourceColumn && source.headers.includes(aiRow.sourceColumn)
          ? aiRow.sourceColumn
          : null;
      const confidence: Confidence = sourceColumn
        ? aiRow?.confidence ?? "low"
        : "low";
      // 매핑 안 된 컬럼에는 변환 정보를 붙이지 않음 (기준 컬럼 변환 집계 오염 방지)
      const transformKind = sourceColumn ? aiRow?.transformKind ?? "none" : "none";
      const dateSourceFormat =
        sourceColumn && transformKind === "date"
          ? aiRow?.dateSourceFormat ?? null
          : null;
      return {
        targetColumn: target,
        sourceColumn,
        confidence,
        transformKind,
        dateSourceFormat,
        transform: aiRow?.transform ?? null,
      };
    });
    return {
      fileName: source.fileName,
      excluded: false,
      notes: aiFile?.notes ?? null,
      rows,
    };
  });
}

export function MergeWizard() {
  const { providerId } = useProvider();

  const [step, setStep] = useState(1);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [failed, setFailed] = useState<FailedFile[]>([]);
  const [baseFileName, setBaseFileName] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewFile[] | null>(null);
  const [valueUnification, setValueUnification] = useState<
    Record<string, Record<string, string>>
  >({});
  const [isMapping, startMapping] = useTransition();

  const baseSheet = useMemo(
    () => sheets.find((s) => s.fileName === baseFileName) ?? null,
    [sheets, baseFileName]
  );
  const sourceSheets = useMemo(
    () => sheets.filter((s) => s.fileName !== baseFileName),
    [sheets, baseFileName]
  );

  // ---- Step 1 handlers (upload) ---------------------------------------
  const handleParsed = useCallback((sheet: ParsedSheet) => {
    setSheets((prev) => [...prev, sheet]);
    // New data invalidates any prior AI mapping.
    setReview(null);
  }, []);

  const handleFailed = useCallback((item: FailedFile) => {
    setFailed((prev) => [...prev, item]);
  }, []);

  const handleRemove = useCallback(
    (fileName: string) => {
      setSheets((prev) => prev.filter((s) => s.fileName !== fileName));
      setFailed((prev) => prev.filter((f) => f.fileName !== fileName));
      if (fileName === baseFileName) setBaseFileName(null);
      setReview(null);
    },
    [baseFileName]
  );

  // ---- Step 2 handler (base selection) --------------------------------
  const handleBaseChange = useCallback((fileName: string) => {
    setBaseFileName(fileName);
    setReview(null);
  }, []);

  // ---- Step 3 (AI mapping) --------------------------------------------
  const runMapping = useCallback(() => {
    if (!baseSheet || sourceSheets.length === 0) return;
    if (!providerId) return;

    startMapping(async () => {
      const result = await runColumnMapping({
        providerId,
        base: toFileMeta(baseSheet),
        sources: sourceSheets.map(toFileMeta),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setReview(buildReview(result.data, baseSheet.headers, sourceSheets));
      setValueUnification({}); // 새 매핑 → 이전 값 통일 적용 초기화
      setStep(4);
    });
  }, [baseSheet, sourceSheets, providerId]);

  // ---- Step 4 (value unification) -------------------------------------
  const handleApplyUnification = useCallback(
    (targetColumn: string, map: Record<string, string>) => {
      setValueUnification((prev) => ({ ...prev, [targetColumn]: map }));
    },
    []
  );

  const handleClearUnification = useCallback((targetColumn: string) => {
    setValueUnification((prev) => {
      const next = { ...prev };
      delete next[targetColumn];
      return next;
    });
  }, []);

  // ---- Step 4 handlers (review edits) ---------------------------------
  const handleChangeSource = useCallback(
    (fileName: string, targetColumn: string, sourceColumn: string | null) => {
      setReview((prev) =>
        prev
          ? prev.map((file) =>
              file.fileName === fileName
                ? {
                    ...file,
                    rows: file.rows.map((row) =>
                      row.targetColumn === targetColumn
                        ? { ...row, sourceColumn }
                        : row
                    ),
                  }
                : file
            )
          : prev
      );
    },
    []
  );

  const handleToggleExclude = useCallback(
    (fileName: string, excluded: boolean) => {
      setReview((prev) =>
        prev
          ? prev.map((file) =>
              file.fileName === fileName ? { ...file, excluded } : file
            )
          : prev
      );
    },
    []
  );

  // ---- Step 5 (merge + download) --------------------------------------
  const handleMerge = useCallback(async () => {
    if (!baseSheet || !review) return;

    const confirmed: ConfirmedFileMapping[] = review.map((file) => ({
      fileName: file.fileName,
      excluded: file.excluded,
      columnMap: Object.fromEntries(
        file.rows.map((row) => [
          row.targetColumn,
          {
            sourceColumn: row.sourceColumn,
            transformKind: row.transformKind,
            dateSourceFormat: row.dateSourceFormat,
          },
        ])
      ),
    }));

    try {
      const output = mergeSheets(baseSheet, sourceSheets, confirmed, {
        valueUnification,
      });
      await downloadMergedWorkbook(output);
      toast.success(
        `총 ${output.fileCount}개 파일, ${output.rowCount.toLocaleString()}행 취합 완료`
      );
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "취합 중 오류가 발생했습니다";
      toast.error(message);
    }
  }, [baseSheet, review, sourceSheets, valueUnification]);

  const reset = useCallback(() => {
    setStep(1);
    setSheets([]);
    setFailed([]);
    setBaseFileName(null);
    setReview(null);
    setValueUnification({});
  }, []);

  // ---- Navigation gating ----------------------------------------------
  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return sheets.length >= 2;
      case 2:
        return baseFileName !== null && sourceSheets.length >= 1;
      case 3:
        return review !== null;
      case 4:
        return review !== null;
      default:
        return false;
    }
  }, [step, sheets.length, baseFileName, sourceSheets.length, review]);

  const goBack = () => setStep((s) => Math.max(1, s - 1));
  const goNext = () => setStep((s) => Math.min(STEPS.length, s + 1));

  return (
    <div className="mt-8 flex flex-col gap-8">
      <StepIndicator steps={STEPS} current={step} />

      <div>
        {/* ---- Step 1: Upload ---- */}
        {step === 1 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">엑셀 파일 업로드</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                취합할 엑셀 파일을 2개 이상 추가하세요. 파일은 브라우저에서만
                분석됩니다.
              </p>
            </div>
            <FileUploader
              sheets={sheets}
              failed={failed}
              onParsed={handleParsed}
              onFailed={handleFailed}
              onRemove={handleRemove}
            />
            {sheets.length === 1 && (
              <p className="text-sm text-muted-foreground">
                취합하려면 파일이 최소 2개 필요합니다.
              </p>
            )}
          </section>
        )}

        {/* ---- Step 2: Base file ---- */}
        {step === 2 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">기준 파일 선택</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                취합 결과의 양식이 될 기준 파일을 고르세요.
              </p>
            </div>
            <BaseFormSelect
              sheets={sheets}
              value={baseFileName}
              onChange={handleBaseChange}
            />
          </section>
        )}

        {/* ---- Step 3: Run AI mapping ---- */}
        {step === 3 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">AI 매핑 실행</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                기준 파일의 컬럼에 맞춰 나머지 {sourceSheets.length}개 파일의
                컬럼을 AI가 매핑합니다. 컬럼명과 샘플 몇 줄만 전송됩니다.
              </p>
            </div>

            {!providerId && (
              <Alert variant="destructive">
                <AlertTitle>AI 모델이 설정되지 않았습니다</AlertTitle>
                <AlertDescription>
                  왼쪽 사이드바에서 API 키를 설정하면 AI 매핑을 사용할 수
                  있습니다.
                </AlertDescription>
              </Alert>
            )}

            {isMapping ? (
              <div className="flex flex-col gap-3 rounded-xl border p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="size-4 animate-spin" />
                  AI가 컬럼을 분석하고 있습니다…
                </div>
                <Progress value={null} />
              </div>
            ) : (
              <div>
                <Button
                  onClick={runMapping}
                  disabled={!providerId || !baseSheet || sourceSheets.length === 0}
                  size="lg"
                >
                  <Sparkles className="size-4" />
                  AI 매핑 실행
                </Button>
              </div>
            )}
          </section>
        )}

        {/* ---- Step 4: Review ---- */}
        {step === 4 && review && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">매핑 검토</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                각 파일의 컬럼 매핑을 확인하고 필요하면 직접 수정하세요.
                확신도가 낮은 항목을 특히 살펴보세요.
              </p>
            </div>
            <MappingReview
              sources={sourceSheets}
              review={review}
              onChangeSource={handleChangeSource}
              onToggleExclude={handleToggleExclude}
            />
            {baseSheet && (
              <ValueUnification
                baseSheet={baseSheet}
                sourceSheets={sourceSheets}
                review={review}
                providerId={providerId}
                applied={valueUnification}
                onApply={handleApplyUnification}
                onClear={handleClearUnification}
              />
            )}
          </section>
        )}

        {/* ---- Step 5: Merge + download ---- */}
        {step === 5 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">취합 및 다운로드</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                기준 파일{" "}
                <span className="font-medium text-foreground">
                  {baseFileName}
                </span>
                의 양식으로{" "}
                {review?.filter((f) => !f.excluded).length ?? 0}개 파일을
                취합합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleMerge} size="lg">
                <Download className="size-4" />
                취합하기
              </Button>
              <Button onClick={reset} variant="outline" size="lg">
                <RotateCcw className="size-4" />
                처음부터 다시
              </Button>
            </div>
          </section>
        )}
      </div>

      {/* ---- Navigation ---- */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="ghost"
          onClick={goBack}
          disabled={step === 1}
          className={cn(step === 1 && "invisible")}
        >
          <ArrowLeft className="size-4" />
          이전
        </Button>

        {step < 4 && (
          <Button onClick={goNext} disabled={!canProceed}>
            다음
            <ArrowRight className="size-4" />
          </Button>
        )}
        {step === 4 && (
          <Button onClick={goNext} disabled={!canProceed}>
            취합 단계로
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
