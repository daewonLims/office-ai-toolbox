/**
 * 규칙: 색상 팔레트 이탈.
 * 기준 팔레트(테마 색 + 자주 쓰인 색) 밖의 색을 사용한 슬라이드를 표시한다.
 * 검정/흰색/회색 계열은 허용 예외.
 */
import type { Rule, Violation } from "../types";
import { paletteColors } from "../baseline";
import { isGrayscale } from "./util";

export const colorPaletteRule: Rule = (model): Violation[] => {
  const palette = paletteColors(model);
  const violations: Violation[] = [];

  for (const slide of model.slides) {
    const offending = new Set<string>();
    for (const shape of slide.shapes) {
      for (const run of shape.runs) {
        const hex = run.colorHex;
        if (!hex) continue;
        if (isGrayscale(hex)) continue; // 회색 계열 허용
        if (palette.has(hex)) continue; // 기준 팔레트 내
        offending.add(hex);
      }
    }
    for (const hex of offending) {
      violations.push({
        ruleId: "color-palette",
        severity: "error",
        slideNumber: slide.slideNumber,
        message: `슬라이드 ${slide.slideNumber}에서 기준 팔레트 밖의 색상 #${hex}이(가) 사용되었습니다.`,
        detail:
          palette.size > 0
            ? `기준 팔레트: ${[...palette].map((c) => `#${c}`).join(", ")}`
            : undefined,
      });
    }
  }
  return violations;
};
