/**
 * 결정적 문서 비교 (브라우저, AI 불필요 — 이 모듈만으로 도구가 동작한다).
 *
 * 1) 문단 단위 LCS → added / removed / unchanged.
 * 2) 인접한 removed+added 쌍은 modified로 병합.
 * 3) modified 쌍 내부는 단어(공백/어절) 단위 LCS로 인라인 하이라이트.
 *
 * 복잡도 가드:
 *  - 문단 LCS 전에 공통 접두/접미 문단을 선제거해 DP 크기를 줄인다.
 *  - 남은 A·B 문단 곱이 MAX_LCS_CELLS를 넘으면 DP를 포기하고 "전부 삭제 후 전부 추가"로
 *    폴백한다(이후 modified 병합 단계가 쌍을 맞춰준다). O(n²) 메모리 폭주 방지.
 *  - 단어 단위 LCS도 토큰 곱 상한(MAX_WORD_CELLS)을 두고, 초과 시 문단 전체를 변경으로 표시.
 */

import type { HunkInput } from "./schema";

/** 문단 LCS DP 셀 상한(≈2000×2000). Int32Array ~16MB. */
const MAX_LCS_CELLS = 4_000_000;
/** 단어 LCS DP 셀 상한. 초과 시 인라인 하이라이트를 생략. */
const MAX_WORD_CELLS = 250_000;

export type HunkType = "unchanged" | "added" | "removed" | "modified";

/** modified 문단의 인라인 조각: changed=true면 변경된 어절. */
export interface WordSegment {
  text: string;
  changed: boolean;
}

export interface DiffHunk {
  type: HunkType;
  /** 이전 버전(A)의 문단 텍스트. added는 null. */
  oldText: string | null;
  /** 새 버전(B)의 문단 텍스트. removed는 null. */
  newText: string | null;
  /** modified 전용: A측 인라인 조각. */
  oldSegments: WordSegment[] | null;
  /** modified 전용: B측 인라인 조각. */
  newSegments: WordSegment[] | null;
}

export interface DiffStats {
  added: number;
  removed: number;
  modified: number;
}

export interface DiffResult {
  hunks: DiffHunk[];
  stats: DiffStats;
  /** 변경이 전혀 없으면 true. */
  identical: boolean;
}

type RawOp =
  | { kind: "same"; a: string; b: string }
  | { kind: "del"; a: string }
  | { kind: "ins"; b: string };

/** 텍스트를 문단 배열로 (붙여넣기 입력용). 줄 단위로 나누고 빈 줄 제거. */
export function paragraphsFromText(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/ /g, " ").trimEnd())
    .filter((l) => l.trim().length > 0);
}

/** 문단 동일성 비교용 정규화 키(내부 공백 축약). 표시는 원문을 유지한다. */
function normKey(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** 공백/비공백 토큰(어절) 단위로 분할. 공백도 토큰으로 보존한다. */
function tokenize(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

/** 인접한 같은 상태(changed) 토큰을 하나의 조각으로 병합. */
function mergeSegments(
  tokens: { text: string; changed: boolean }[]
): WordSegment[] {
  const segs: WordSegment[] = [];
  for (const t of tokens) {
    const last = segs[segs.length - 1];
    if (last && last.changed === t.changed) last.text += t.text;
    else segs.push({ text: t.text, changed: t.changed });
  }
  return segs;
}

/** modified 쌍의 단어 단위 인라인 diff → [A 조각, B 조각]. */
function wordDiff(oldStr: string, newStr: string): [WordSegment[], WordSegment[]] {
  const a = tokenize(oldStr);
  const b = tokenize(newStr);

  if (a.length === 0 || b.length === 0 || a.length * b.length > MAX_WORD_CELLS) {
    // 폴백: 문단 전체를 변경으로 표시(인라인 세분화 생략)
    return [
      [{ text: oldStr, changed: true }],
      [{ text: newStr, changed: true }],
    ];
  }

  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const dp = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] =
        a[i] === b[j]
          ? dp[(i + 1) * w + (j + 1)] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + (j + 1)]);
    }
  }

  const oldTokens: { text: string; changed: boolean }[] = [];
  const newTokens: { text: string; changed: boolean }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      oldTokens.push({ text: a[i], changed: false });
      newTokens.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) {
      oldTokens.push({ text: a[i], changed: true });
      i++;
    } else {
      newTokens.push({ text: b[j], changed: true });
      j++;
    }
  }
  while (i < n) oldTokens.push({ text: a[i++], changed: true });
  while (j < m) newTokens.push({ text: b[j++], changed: true });

  return [mergeSegments(oldTokens), mergeSegments(newTokens)];
}

/** 폭주 방지 폴백: 전부 삭제 후 전부 추가. */
function fallbackOps(a: string[], b: string[]): RawOp[] {
  return [
    ...a.map((x): RawOp => ({ kind: "del", a: x })),
    ...b.map((x): RawOp => ({ kind: "ins", b: x })),
  ];
}

/** 접두/접미 제거 후 남은 중간 구간의 문단 LCS. */
function diffMiddle(a: string[], b: string[]): RawOp[] {
  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return b.map((x): RawOp => ({ kind: "ins", b: x }));
  if (b.length === 0) return a.map((x): RawOp => ({ kind: "del", a: x }));
  if (a.length * b.length > MAX_LCS_CELLS) return fallbackOps(a, b);

  const ka = a.map(normKey);
  const kb = b.map(normKey);
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const dp = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] =
        ka[i] === kb[j]
          ? dp[(i + 1) * w + (j + 1)] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + (j + 1)]);
    }
  }

  const ops: RawOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ka[i] === kb[j]) {
      ops.push({ kind: "same", a: a[i], b: b[j] });
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) {
      ops.push({ kind: "del", a: a[i] });
      i++;
    } else {
      ops.push({ kind: "ins", b: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ kind: "del", a: a[i++] });
  while (j < m) ops.push({ kind: "ins", b: b[j++] });
  return ops;
}

/** 공통 접두/접미 선제거 후 문단 LCS. */
function diffParagraphs(a: string[], b: string[]): RawOp[] {
  let start = 0;
  while (
    start < a.length &&
    start < b.length &&
    normKey(a[start]) === normKey(b[start])
  ) {
    start++;
  }
  let endA = a.length;
  let endB = b.length;
  while (
    endA > start &&
    endB > start &&
    normKey(a[endA - 1]) === normKey(b[endB - 1])
  ) {
    endA--;
    endB--;
  }

  const ops: RawOp[] = [];
  for (let k = 0; k < start; k++) ops.push({ kind: "same", a: a[k], b: b[k] });
  ops.push(...diffMiddle(a.slice(start, endA), b.slice(start, endB)));
  const suffixLen = a.length - endA; // === b.length - endB
  for (let t = 0; t < suffixLen; t++) {
    ops.push({ kind: "same", a: a[endA + t], b: b[endB + t] });
  }
  return ops;
}

/** RawOp 목록 → Hunk 목록. 비-same 블록에서 del/ins를 modified로 병합. */
function toHunks(ops: RawOp[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let idx = 0;
  while (idx < ops.length) {
    const op = ops[idx];
    if (op.kind === "same") {
      hunks.push({
        type: "unchanged",
        oldText: op.a,
        newText: op.b,
        oldSegments: null,
        newSegments: null,
      });
      idx++;
      continue;
    }

    // 비-same 블록 수집
    const dels: string[] = [];
    const inses: string[] = [];
    while (idx < ops.length && ops[idx].kind !== "same") {
      const o = ops[idx];
      if (o.kind === "del") dels.push(o.a);
      else if (o.kind === "ins") inses.push(o.b);
      idx++;
    }

    const pairs = Math.min(dels.length, inses.length);
    for (let t = 0; t < pairs; t++) {
      const [oldSeg, newSeg] = wordDiff(dels[t], inses[t]);
      hunks.push({
        type: "modified",
        oldText: dels[t],
        newText: inses[t],
        oldSegments: oldSeg,
        newSegments: newSeg,
      });
    }
    for (let t = pairs; t < dels.length; t++) {
      hunks.push({
        type: "removed",
        oldText: dels[t],
        newText: null,
        oldSegments: null,
        newSegments: null,
      });
    }
    for (let t = pairs; t < inses.length; t++) {
      hunks.push({
        type: "added",
        oldText: null,
        newText: inses[t],
        oldSegments: null,
        newSegments: null,
      });
    }
  }
  return hunks;
}

/** 두 문단 배열을 비교해 Hunk 목록·통계를 계산. */
export function computeDiff(aParas: string[], bParas: string[]): DiffResult {
  const hunks = toHunks(diffParagraphs(aParas, bParas));
  const stats: DiffStats = { added: 0, removed: 0, modified: 0 };
  for (const h of hunks) {
    if (h.type === "added") stats.added++;
    else if (h.type === "removed") stats.removed++;
    else if (h.type === "modified") stats.modified++;
  }
  const identical =
    stats.added === 0 && stats.removed === 0 && stats.modified === 0;
  return { hunks, stats, identical };
}

/** 변경된 훅만(순서 유지). 화면 앵커 인덱스 = 이 배열의 위치와 일치한다. */
export function changedHunks(result: DiffResult): DiffHunk[] {
  return result.hunks.filter((h) => h.type !== "unchanged");
}

/** 변경 훅 → AI 전송용 입력(unchanged는 애초에 제외되어 있음). */
export function toHunkInput(h: DiffHunk): HunkInput {
  return {
    type: h.type as "added" | "removed" | "modified",
    oldText: h.oldText,
    newText: h.newText,
  };
}
