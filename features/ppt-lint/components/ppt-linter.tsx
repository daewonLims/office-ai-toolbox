"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FileUploader } from "./file-uploader";
import { ReportView } from "./report-view";
import { AiSummary } from "./ai-summary";
import { runAllRules } from "../lib/rules";
import type { PresentationModel } from "../lib/types";

export function PptLinter() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [model, setModel] = useState<PresentationModel | null>(null);

  const violations = useMemo(
    () => (model ? runAllRules(model) : []),
    [model]
  );

  return (
    <div className="mt-6 flex flex-col gap-6">
      <FileUploader
        fileName={fileName}
        onParsed={(name, parsed) => {
          setFileName(name);
          setModel(parsed);
        }}
      />

      {model && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">검사 결과</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFileName(null);
                setModel(null);
              }}
            >
              <RotateCcw />
              다시 시작
            </Button>
          </div>

          <ReportView model={model} violations={violations} />

          <section className="border-t pt-6">
            <h2 className="text-lg font-semibold">AI 개선 리포트 (선택)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              위반 통계와 스타일 메타데이터를 바탕으로 개선 방향을 제안받습니다.
            </p>
            <div className="mt-4">
              <AiSummary model={model} violations={violations} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
