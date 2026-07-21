"use client";

import { useMemo, useState } from "react";
import { Columns2, Rows3, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DEMO } from "../lib/demo";
import { MAX_DOC_LEN } from "../lib/schema";
import {
  changedHunks,
  computeDiff,
  paragraphsFromText,
  toHunkInput,
} from "../lib/diff";
import { SourcePanel, type SourceMode } from "./source-panel";
import { DiffView, type DiffViewMode } from "./diff-view";
import { AiReport } from "./ai-report";

export function DocDiff() {
  const [aMode, setAMode] = useState<SourceMode>("paste");
  const [aText, setAText] = useState("");
  const [aFileName, setAFileName] = useState<string | null>(null);

  const [bMode, setBMode] = useState<SourceMode>("paste");
  const [bText, setBText] = useState("");
  const [bFileName, setBFileName] = useState<string | null>(null);

  const [view, setView] = useState<DiffViewMode>("split");
  const [highlighted, setHighlighted] = useState<number[]>([]);
  const [focusNonce, setFocusNonce] = useState(0);

  const aOver = aText.length > MAX_DOC_LEN;
  const bOver = bText.length > MAX_DOC_LEN;

  const aParas = useMemo(() => paragraphsFromText(aText), [aText]);
  const bParas = useMemo(() => paragraphsFromText(bText), [bText]);

  const canCompare =
    !aOver && !bOver && (aParas.length > 0 || bParas.length > 0);

  const result = useMemo(() => {
    if (!canCompare) return null;
    return computeDiff(aParas, bParas);
  }, [canCompare, aParas, bParas]);

  const changed = useMemo(
    () => (result ? changedHunks(result) : []),
    [result]
  );
  const hunkInputs = useMemo(() => changed.map(toHunkInput), [changed]);

  // 입력이 바뀌면 이전 하이라이트는 무효(훅 인덱스가 달라짐) → 텍스트 변경 시 함께 초기화.
  const updateAText = (t: string) => {
    setAText(t);
    setHighlighted([]);
  };
  const updateBText = (t: string) => {
    setBText(t);
    setHighlighted([]);
  };

  const loadDemo = () => {
    setAMode("paste");
    setBMode("paste");
    setAText(DEMO.before);
    setBText(DEMO.after);
    setAFileName(null);
    setBFileName(null);
    setHighlighted([]);
  };

  const clearAll = () => {
    setAText("");
    setBText("");
    setAFileName(null);
    setBFileName(null);
    setHighlighted([]);
  };

  const focusHunks = (indexes: number[]) => {
    setHighlighted(indexes);
    setFocusNonce((n) => n + 1);
  };

  const isEmpty = aText.trim() === "" && bText.trim() === "";
  // AiReport는 입력이 바뀌면 이전 결과를 버리도록 시그니처로 리마운트한다.
  const reportKey = `${aText.length}|${bText.length}|${changed.length}`;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={loadDemo}>
          <Wand2 />
          예시 불러오기
        </Button>
        {!isEmpty && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            비우기
          </Button>
        )}
      </div>

      {/* 좌우 입력 패널 */}
      <div className="grid gap-4 md:grid-cols-2">
        <SourcePanel
          label="이전 버전"
          badge="A"
          mode={aMode}
          onModeChange={setAMode}
          text={aText}
          onTextChange={updateAText}
          fileName={aFileName}
          onFile={(name, text) => {
            setAFileName(name);
            updateAText(text);
          }}
        />
        <SourcePanel
          label="새 버전"
          badge="B"
          mode={bMode}
          onModeChange={setBMode}
          text={bText}
          onTextChange={updateBText}
          fileName={bFileName}
          onFile={(name, text) => {
            setBFileName(name);
            updateBText(text);
          }}
        />
      </div>

      {(aOver || bOver) && (
        <p className="text-sm text-destructive">
          각 문서는 최대 {MAX_DOC_LEN.toLocaleString()}자까지 비교할 수 있습니다.
          초과한 쪽의 내용을 줄여 주세요.
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4 border-t pt-6">
          {/* 통계 + 뷰 토글 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatBadge
                label="추가"
                count={result.stats.added}
                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              />
              <StatBadge
                label="삭제"
                count={result.stats.removed}
                className="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
              />
              <StatBadge
                label="수정"
                count={result.stats.modified}
                className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
              />
            </div>

            {!result.identical && (
              <div className="inline-flex rounded-md border p-0.5">
                <ViewButton
                  active={view === "split"}
                  onClick={() => setView("split")}
                  icon={<Columns2 className="size-3.5" />}
                  label="나란히"
                />
                <ViewButton
                  active={view === "unified"}
                  onClick={() => setView("unified")}
                  icon={<Rows3 className="size-3.5" />}
                  label="통합"
                />
              </div>
            )}
          </div>

          {result.identical ? (
            <div className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              두 버전이 동일합니다. 변경된 내용이 없습니다.
            </div>
          ) : (
            <>
              <DiffView
                result={result}
                mode={view}
                highlighted={highlighted}
                focusNonce={focusNonce}
              />

              <div className="border-t pt-6">
                <AiReport
                  key={reportKey}
                  hunkInputs={hunkInputs}
                  onFocusHunks={focusHunks}
                />
              </div>
            </>
          )}
        </div>
      )}

      {!result && !aOver && !bOver && (
        <p className="text-sm text-muted-foreground">
          두 버전의 문서를 붙여넣거나 .docx로 업로드하면 변경 내용을 문단 단위로
          비교합니다. 처음이라면 &lsquo;예시 불러오기&rsquo;로 바로 확인해 보세요.
        </p>
      )}
    </div>
  );
}

function StatBadge({
  label,
  count,
  className,
}: {
  label: string;
  count: number;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
        className
      )}
    >
      {label} {count}
    </span>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
