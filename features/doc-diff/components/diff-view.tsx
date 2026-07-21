"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";
import type { DiffHunk, DiffResult, WordSegment } from "../lib/diff";

export type DiffViewMode = "split" | "unified";

/** modified 문단의 인라인 조각 렌더. tone에 따라 삭제(적색)/추가(녹색) 강조. */
function Segments({
  segments,
  tone,
}: {
  segments: WordSegment[];
  tone: "removed" | "added";
}) {
  return (
    <>
      {segments.map((s, i) =>
        s.changed ? (
          <mark
            key={i}
            className={cn(
              "rounded-sm px-0.5",
              tone === "removed"
                ? "bg-rose-200/70 text-rose-900 line-through dark:bg-rose-900/50 dark:text-rose-100"
                : "bg-emerald-200/70 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
            )}
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  );
}

const PARA_CLASS = "whitespace-pre-wrap break-words text-sm leading-relaxed";

/** A(이전)측 셀 내용. */
function OldContent({ hunk }: { hunk: DiffHunk }) {
  if (hunk.type === "added") {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }
  if (hunk.type === "modified" && hunk.oldSegments) {
    return (
      <p className={PARA_CLASS}>
        <Segments segments={hunk.oldSegments} tone="removed" />
      </p>
    );
  }
  if (hunk.type === "removed") {
    return (
      <p className={cn(PARA_CLASS, "text-rose-900 line-through dark:text-rose-200")}>
        {hunk.oldText}
      </p>
    );
  }
  return <p className={cn(PARA_CLASS, "text-muted-foreground")}>{hunk.oldText}</p>;
}

/** B(새)측 셀 내용. */
function NewContent({ hunk }: { hunk: DiffHunk }) {
  if (hunk.type === "removed") {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }
  if (hunk.type === "modified" && hunk.newSegments) {
    return (
      <p className={PARA_CLASS}>
        <Segments segments={hunk.newSegments} tone="added" />
      </p>
    );
  }
  if (hunk.type === "added") {
    return (
      <p className={cn(PARA_CLASS, "text-emerald-900 dark:text-emerald-200")}>
        {hunk.newText}
      </p>
    );
  }
  return <p className={cn(PARA_CLASS, "text-muted-foreground")}>{hunk.newText}</p>;
}

/** hunk 유형별 좌측 경계·배경 톤. */
function rowTone(type: DiffHunk["type"]): string {
  switch (type) {
    case "added":
      return "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/25";
    case "removed":
      return "border-rose-500 bg-rose-50/60 dark:bg-rose-950/25";
    case "modified":
      return "border-amber-500 bg-amber-50/60 dark:bg-amber-950/25";
    default:
      return "border-transparent";
  }
}

const MARKER: Record<DiffHunk["type"], string> = {
  added: "+",
  removed: "−",
  modified: "~",
  unchanged: "",
};

export function DiffView({
  result,
  mode,
  highlighted,
  focusNonce,
}: {
  result: DiffResult;
  mode: DiffViewMode;
  /** 강조할 변경 훅 인덱스(AI 그룹 클릭 시). */
  highlighted: number[];
  /** 값이 바뀌면 highlighted의 첫 훅으로 스크롤. */
  focusNonce: number;
}) {
  const highlightSet = new Set(highlighted);

  // 포커스 요청 시 첫 대상 훅으로 스크롤.
  useEffect(() => {
    if (highlighted.length === 0) return;
    const el = document.getElementById(`dd-hunk-${highlighted[0]}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusNonce, highlighted]);

  // 변경 훅에 순번(AI hunkIndexes와 일치하는 앵커 인덱스)을 부여한다.
  let changedIndex = -1;

  return (
    <div className="overflow-hidden rounded-lg border">
      {mode === "split" && (
        <div className="grid grid-cols-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
          <div className="border-r px-3 py-1.5">이전 버전 (A)</div>
          <div className="px-3 py-1.5">새 버전 (B)</div>
        </div>
      )}

      <div className="flex flex-col divide-y">
        {result.hunks.map((hunk, i) => {
          const isChanged = hunk.type !== "unchanged";
          if (isChanged) changedIndex++;
          const anchorIndex = isChanged ? changedIndex : -1;
          const isHot = isChanged && highlightSet.has(anchorIndex);

          const rowProps = isChanged
            ? { id: `dd-hunk-${anchorIndex}` }
            : {};

          if (mode === "split") {
            return (
              <div
                key={i}
                {...rowProps}
                className={cn(
                  "grid grid-cols-2 scroll-mt-24 transition-colors",
                  isHot && "ring-2 ring-inset ring-primary/70"
                )}
              >
                <div
                  className={cn(
                    "min-w-0 border-r border-l-2 px-3 py-2",
                    rowTone(hunk.type === "added" ? "unchanged" : hunk.type)
                  )}
                >
                  <OldContent hunk={hunk} />
                </div>
                <div
                  className={cn(
                    "min-w-0 border-l-2 px-3 py-2",
                    rowTone(hunk.type === "removed" ? "unchanged" : hunk.type)
                  )}
                >
                  <NewContent hunk={hunk} />
                </div>
              </div>
            );
          }

          // 통합(unified) 뷰
          return (
            <div
              key={i}
              {...rowProps}
              className={cn(
                "flex scroll-mt-24 flex-col gap-1 border-l-2 px-3 py-2 transition-colors",
                rowTone(hunk.type),
                isHot && "ring-2 ring-inset ring-primary/70"
              )}
            >
              {hunk.type === "unchanged" ? (
                <p className={cn(PARA_CLASS, "text-muted-foreground")}>
                  {hunk.oldText}
                </p>
              ) : hunk.type === "modified" ? (
                <>
                  <div className="flex gap-2">
                    <span className="select-none pt-0.5 text-xs font-bold text-rose-500">
                      −
                    </span>
                    <p className={PARA_CLASS}>
                      <Segments segments={hunk.oldSegments ?? []} tone="removed" />
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="select-none pt-0.5 text-xs font-bold text-emerald-600">
                      +
                    </span>
                    <p className={PARA_CLASS}>
                      <Segments segments={hunk.newSegments ?? []} tone="added" />
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <span
                    className={cn(
                      "select-none pt-0.5 text-xs font-bold",
                      hunk.type === "added" ? "text-emerald-600" : "text-rose-500"
                    )}
                  >
                    {MARKER[hunk.type]}
                  </span>
                  {hunk.type === "added" ? (
                    <p className={cn(PARA_CLASS, "text-emerald-900 dark:text-emerald-200")}>
                      {hunk.newText}
                    </p>
                  ) : (
                    <p
                      className={cn(
                        PARA_CLASS,
                        "text-rose-900 line-through dark:text-rose-200"
                      )}
                    >
                      {hunk.oldText}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
