/**
 * 규칙: 바닥글/슬라이드 번호 누락.
 * 다수(과반) 슬라이드에는 있는데 일부 슬라이드에만 없는 경우를 표시한다.
 */
import type { PresentationModel, Rule, Violation } from "../types";

function checkPresence(
  model: PresentationModel,
  has: (s: PresentationModel["slides"][number]) => boolean,
  ruleId: string,
  label: string
): Violation[] {
  const slides = model.slides;
  if (slides.length < 2) return [];
  const present = slides.filter(has).length;
  // 과반 슬라이드에 존재할 때만 "누락"으로 판단 (모두 없으면 의도적 부재로 간주)
  if (present <= slides.length / 2) return [];

  const violations: Violation[] = [];
  for (const slide of slides) {
    if (!has(slide)) {
      violations.push({
        ruleId,
        severity: "info",
        slideNumber: slide.slideNumber,
        message: `슬라이드 ${slide.slideNumber}에 ${label}이(가) 없습니다. (다른 슬라이드에는 있음)`,
      });
    }
  }
  return violations;
}

export const footerMissingRule: Rule = (model): Violation[] => [
  ...checkPresence(model, (s) => s.hasFooter, "footer-missing", "바닥글"),
  ...checkPresence(model, (s) => s.hasSlideNumber, "slidenumber-missing", "슬라이드 번호"),
];
