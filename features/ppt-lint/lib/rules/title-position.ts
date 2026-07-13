/**
 * 규칙: 제목 위치 편차.
 * 제목 placeholder의 좌표가 다수결(중앙값) 위치에서 임계값 이상 벗어난 슬라이드를 표시.
 */
import type { PresentationModel, Rule, Violation } from "../types";
import { TITLE_POSITION_THRESHOLD_EMU } from "../constants";
import { median } from "./util";

interface TitlePos {
  slideNumber: number;
  x: number;
  y: number;
}

function collectTitlePositions(model: PresentationModel): TitlePos[] {
  const out: TitlePos[] = [];
  for (const slide of model.slides) {
    for (const shape of slide.shapes) {
      if (shape.isTitle && shape.offset) {
        out.push({ slideNumber: slide.slideNumber, x: shape.offset.x, y: shape.offset.y });
        break; // 슬라이드당 첫 제목만
      }
    }
  }
  return out;
}

/** EMU → 인치 (표시용) */
function emuToInch(emu: number): string {
  return (emu / 914400).toFixed(2);
}

export const titlePositionRule: Rule = (model): Violation[] => {
  const positions = collectTitlePositions(model);
  if (positions.length < 2) return [];

  const baseX = median(positions.map((p) => p.x));
  const baseY = median(positions.map((p) => p.y));
  if (baseX == null || baseY == null) return [];

  const violations: Violation[] = [];
  for (const p of positions) {
    const dx = Math.abs(p.x - baseX);
    const dy = Math.abs(p.y - baseY);
    if (dx > TITLE_POSITION_THRESHOLD_EMU || dy > TITLE_POSITION_THRESHOLD_EMU) {
      violations.push({
        ruleId: "title-position",
        severity: "warning",
        slideNumber: p.slideNumber,
        message: `슬라이드 ${p.slideNumber}의 제목 위치가 기준 위치에서 벗어났습니다 (가로 ${emuToInch(
          dx
        )}″, 세로 ${emuToInch(dy)}″ 차이).`,
        detail: `기준 제목 위치(중앙값): 가로 ${emuToInch(baseX)}″, 세로 ${emuToInch(
          baseY
        )}″`,
      });
    }
  }
  return violations;
};
