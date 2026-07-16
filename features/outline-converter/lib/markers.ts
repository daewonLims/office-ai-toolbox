/**
 * 계층 기호(marker) 결정적 조립.
 *
 * LLM은 { level, text } 만 반환하고, 계층 기호(□ ○ - / 번호 등)와 들여쓰기는
 * 여기서 프리셋에 맞춰 결정적으로 부여한다. 이렇게 해야 기호 일관성이 보장된다.
 */
import type { Direction, OutlineLine, Preset } from "./schema";

/** 레벨당 들여쓰기(공백 2칸). */
const INDENT_UNIT = "  ";

/** 유효 레벨(0~3)로 정규화. */
function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(3, Math.trunc(level)));
}

/** 공공기관형 기호: □ ○ - · */
const PUBLIC_MARKERS = ["□", "○", "-", "·"] as const;

/**
 * 카운터를 현재 레벨에서 1 증가시키고 더 깊은 레벨은 리셋한다.
 * (번호 매기기 프리셋에서 사용)
 */
function bump(counters: number[], level: number): void {
  counters[level] += 1;
  for (let i = level + 1; i < counters.length; i++) counters[i] = 0;
}

/**
 * 개조식 방향의 각 라인에 프리셋 기호 + 들여쓰기를 적용해 문자열 배열로 반환한다.
 */
export function applyMarkers(lines: OutlineLine[], preset: Preset): string[] {
  // corporate 번호 매기기용 레벨별 카운터
  const counters = [0, 0, 0, 0];

  return lines.map((line) => {
    const level = clampLevel(line.level);
    const indent = INDENT_UNIT.repeat(level);
    const text = line.text.trim();

    let marker: string;
    switch (preset) {
      case "public": {
        marker = PUBLIC_MARKERS[level];
        break;
      }
      case "corporate": {
        // 1. / 1) / - / · 체계
        if (level === 0) {
          bump(counters, 0);
          marker = `${counters[0]}.`;
        } else if (level === 1) {
          bump(counters, 1);
          marker = `${counters[1]})`;
        } else if (level === 2) {
          marker = "-";
        } else {
          marker = "·";
        }
        break;
      }
      case "meeting": {
        // 전 레벨 불릿(-), 깊이는 들여쓰기로 표현
        marker = "-";
        break;
      }
      default: {
        marker = "-";
      }
    }

    return `${indent}${marker} ${text}`;
  });
}

/**
 * 렌더/복사에 쓸 최종 텍스트를 조립한다.
 *  - to-outline: 프리셋 기호가 적용된 라인들을 줄바꿈으로 연결
 *  - to-prose:   level 0 문단들을 빈 줄로 구분해 연결(기호 없음)
 */
export function assembleText(
  lines: OutlineLine[],
  direction: Direction,
  preset: Preset
): string {
  if (direction === "to-prose") {
    return lines
      .map((l) => l.text.trim())
      .filter((t) => t.length > 0)
      .join("\n\n");
  }
  return applyMarkers(lines, preset).join("\n");
}
