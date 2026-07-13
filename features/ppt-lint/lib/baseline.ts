/**
 * 기준 스타일(다수결) 추정 — 규칙과 리포트 UI가 공유한다.
 */
import { PALETTE_MIN_SLIDES } from "./constants";
import type { PresentationModel } from "./types";
import { mode } from "./rules/util";
import { isGrayscale } from "./rules/util";

export interface FontCount {
  name: string;
  count: number;
}

export interface Baseline {
  /** 다수결 기준 글꼴 (가장 많이 쓰인 런 글꼴) */
  font: string | null;
  /** 글꼴별 런 사용 횟수 (내림차순) */
  fontCounts: FontCount[];
  /** 기준 팔레트 hex 목록 (테마 색 + 2개 이상 슬라이드에서 쓰인 색) */
  palette: string[];
  themeMajorFont: string | null;
  themeMinorFont: string | null;
}

/** 모든 런의 글꼴 사용 횟수 */
export function fontCounts(model: PresentationModel): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slide of model.slides) {
    for (const shape of slide.shapes) {
      for (const run of shape.runs) {
        if (run.font) counts.set(run.font, (counts.get(run.font) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** 색상별 "사용된 슬라이드 번호 집합" */
export function colorSlideSets(
  model: PresentationModel
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const slide of model.slides) {
    for (const shape of slide.shapes) {
      for (const run of shape.runs) {
        if (!run.colorHex) continue;
        if (!map.has(run.colorHex)) map.set(run.colorHex, new Set());
        map.get(run.colorHex)!.add(slide.slideNumber);
      }
    }
  }
  return map;
}

/** 기준 팔레트: 테마 색 ∪ (PALETTE_MIN_SLIDES개 이상 슬라이드에서 쓰인 색) */
export function paletteColors(model: PresentationModel): Set<string> {
  const palette = new Set<string>();
  for (const c of model.theme?.schemeColors ?? []) palette.add(c.toUpperCase());
  for (const [hex, slides] of colorSlideSets(model)) {
    if (slides.size >= PALETTE_MIN_SLIDES) palette.add(hex);
  }
  return palette;
}

export function computeBaseline(model: PresentationModel): Baseline {
  const counts = fontCounts(model);
  const sorted: FontCount[] = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  return {
    font: mode(counts),
    fontCounts: sorted,
    palette: [...paletteColors(model)].sort(),
    themeMajorFont: model.theme?.majorFont ?? null,
    themeMinorFont: model.theme?.minorFont ?? null,
  };
}

export { isGrayscale };
