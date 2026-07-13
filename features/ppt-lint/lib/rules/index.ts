/**
 * 규칙 레지스트리 + 실행기.
 * 각 규칙은 순수 함수: PresentationModel → Violation[].
 */
import type { PresentationModel, Rule, Severity, Violation } from "../types";
import { fontConsistencyRule } from "./font-consistency";
import { fontSizeRule } from "./font-size";
import { colorPaletteRule } from "./color-palette";
import { titlePositionRule } from "./title-position";
import { footerMissingRule } from "./footer-missing";

export const rules: Rule[] = [
  fontConsistencyRule,
  fontSizeRule,
  colorPaletteRule,
  titlePositionRule,
  footerMissingRule,
];

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** 모든 규칙을 실행하고 슬라이드 번호 → 심각도 순으로 정렬된 위반 목록을 반환 */
export function runAllRules(model: PresentationModel): Violation[] {
  const all = rules.flatMap((rule) => rule(model));
  return all.sort((a, b) => {
    if (a.slideNumber !== b.slideNumber) return a.slideNumber - b.slideNumber;
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });
}

export const RULE_LABELS: Record<string, string> = {
  "font-consistency": "글꼴 불일치",
  "font-size": "글꼴 크기 편차",
  "color-palette": "색상 팔레트 이탈",
  "title-position": "제목 위치 편차",
  "footer-missing": "바닥글 누락",
  "slidenumber-missing": "슬라이드 번호 누락",
};
