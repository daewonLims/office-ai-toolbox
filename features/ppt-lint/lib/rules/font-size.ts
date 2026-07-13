/**
 * 규칙: 글꼴 크기 편차.
 * 같은 역할(제목끼리 / 본문끼리)에서 다수결 크기와 다른 슬라이드를 표시한다.
 */
import type { PresentationModel, Rule, Violation } from "../types";
import { mode } from "./util";

type Role = "title" | "body";

function roleOf(placeholderType: string | null, isTitle: boolean): Role | null {
  if (isTitle) return "title";
  if (placeholderType === "body" || placeholderType === "subTitle") return "body";
  return null; // ftr/sldNum/dt 등 및 비-placeholder는 크기 비교 대상에서 제외
}

/** 역할별로 (슬라이드번호 → 그 슬라이드에서 관측된 크기 집합) 수집 */
function sizesByRole(model: PresentationModel, role: Role) {
  const bySlide = new Map<number, Set<number>>();
  const globalCounts = new Map<number, number>();
  for (const slide of model.slides) {
    for (const shape of slide.shapes) {
      if (roleOf(shape.placeholderType, shape.isTitle) !== role) continue;
      for (const run of shape.runs) {
        if (run.sizeHundredths == null) continue;
        if (!bySlide.has(slide.slideNumber)) bySlide.set(slide.slideNumber, new Set());
        bySlide.get(slide.slideNumber)!.add(run.sizeHundredths);
        globalCounts.set(
          run.sizeHundredths,
          (globalCounts.get(run.sizeHundredths) ?? 0) + 1
        );
      }
    }
  }
  return { bySlide, baseline: mode(globalCounts) };
}

const ROLE_LABEL: Record<Role, string> = { title: "제목", body: "본문" };

function checkRole(model: PresentationModel, role: Role): Violation[] {
  const { bySlide, baseline } = sizesByRole(model, role);
  if (baseline == null || bySlide.size < 2) return [];

  const violations: Violation[] = [];
  for (const [slideNumber, sizes] of bySlide) {
    for (const size of sizes) {
      if (size !== baseline) {
        violations.push({
          ruleId: "font-size",
          severity: "warning",
          slideNumber,
          message: `슬라이드 ${slideNumber}의 ${ROLE_LABEL[role]} 글꼴 크기(${size / 100}pt)가 기준 크기(${
            baseline / 100
          }pt)와 다릅니다.`,
        });
      }
    }
  }
  return violations;
}

export const fontSizeRule: Rule = (model): Violation[] => [
  ...checkRole(model, "title"),
  ...checkRole(model, "body"),
];
