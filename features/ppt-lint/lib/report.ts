/**
 * 위반 목록 → 리포트 통계 및 AI 요청 페이로드 조립 (클라이언트 안전).
 *
 * AI로 나가는 것은 스타일 메타데이터뿐이다: 글꼴 목록·빈도, 팔레트 hex,
 * 규칙별 위반 수, 대표 위반 메시지. 슬라이드 본문 텍스트는 전송하지 않는다.
 */
import type { PresentationModel, Severity, Violation } from "./types";
import { computeBaseline } from "./baseline";
import { RULE_LABELS } from "./rules";
import {
  MAX_SAMPLE_MESSAGES,
  type SummaryRequest,
} from "./summary-schema";
import type { ProviderId } from "@/lib/ai/types";

export interface ReportStats {
  totalSlides: number;
  totalViolations: number;
  severityCounts: Record<Severity, number>;
  ruleCounts: { ruleId: string; label: string; count: number }[];
}

export function computeStats(
  model: PresentationModel,
  violations: Violation[]
): ReportStats {
  const severityCounts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  const byRule = new Map<string, number>();
  for (const v of violations) {
    severityCounts[v.severity] += 1;
    byRule.set(v.ruleId, (byRule.get(v.ruleId) ?? 0) + 1);
  }
  const ruleCounts = [...byRule.entries()]
    .map(([ruleId, count]) => ({
      ruleId,
      label: RULE_LABELS[ruleId] ?? ruleId,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalSlides: model.slides.length,
    totalViolations: violations.length,
    severityCounts,
    ruleCounts,
  };
}

/** 대표 위반 메시지를 규칙별로 골고루 최대 N개 뽑는다 */
function pickSampleMessages(violations: Violation[], limit: number): string[] {
  const byRule = new Map<string, string[]>();
  for (const v of violations) {
    if (!byRule.has(v.ruleId)) byRule.set(v.ruleId, []);
    byRule.get(v.ruleId)!.push(v.message);
  }
  const samples: string[] = [];
  // 규칙별로 한 개씩 라운드로빈
  let added = true;
  let round = 0;
  while (added && samples.length < limit) {
    added = false;
    for (const msgs of byRule.values()) {
      if (round < msgs.length && samples.length < limit) {
        samples.push(msgs[round]);
        added = true;
      }
    }
    round += 1;
  }
  return samples;
}

export function buildSummaryRequest(
  providerId: ProviderId,
  model: PresentationModel,
  violations: Violation[]
): SummaryRequest {
  const stats = computeStats(model, violations);
  const baseline = computeBaseline(model);
  return {
    providerId,
    totalSlides: stats.totalSlides,
    totalViolations: stats.totalViolations,
    baselineFont: baseline.font,
    themeMajorFont: baseline.themeMajorFont,
    fonts: baseline.fontCounts.slice(0, 50),
    palette: baseline.palette.map((c) => `#${c}`).slice(0, 50),
    ruleCounts: stats.ruleCounts,
    severityCounts: stats.severityCounts,
    sampleMessages: pickSampleMessages(violations, MAX_SAMPLE_MESSAGES),
  };
}
