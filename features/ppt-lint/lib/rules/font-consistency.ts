/**
 * 규칙: 글꼴 불일치.
 * 다수결 글꼴을 기준으로, 그와 다른 글꼴을 쓰는 슬라이드를 표시한다.
 */
import type { Rule, Violation } from "../types";
import { fontCounts } from "../baseline";
import { mode } from "./util";

export const fontConsistencyRule: Rule = (model): Violation[] => {
  const counts = fontCounts(model);
  const baseline = mode(counts);
  // 글꼴이 하나뿐이거나 정보가 없으면 검사 불가
  if (!baseline || counts.size < 2) return [];

  const violations: Violation[] = [];
  for (const slide of model.slides) {
    const offending = new Set<string>();
    for (const shape of slide.shapes) {
      for (const run of shape.runs) {
        if (run.font && run.font !== baseline) offending.add(run.font);
      }
    }
    for (const font of offending) {
      violations.push({
        ruleId: "font-consistency",
        severity: "error",
        slideNumber: slide.slideNumber,
        message: `슬라이드 ${slide.slideNumber}에서 기준 글꼴 "${baseline}"과 다른 글꼴 "${font}"이(가) 사용되었습니다.`,
        detail: `프레젠테이션 전반의 다수결 글꼴은 "${baseline}"입니다.`,
      });
    }
  }
  return violations;
};
