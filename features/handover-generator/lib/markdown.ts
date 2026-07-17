/**
 * 생성된 인수인계서를 마크다운 문자열로 조립한다(클립보드 복사용).
 * 서버/클라이언트/노드 어디서나 사용할 수 있는 순수 함수.
 */
import type { HandoverResponse, MissingPriority } from "./schema";

const PRIORITY_LABEL: Record<MissingPriority, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
};

export function toMarkdown(data: HandoverResponse): string {
  const lines: string[] = [];

  lines.push(`# ${data.title}`);
  lines.push("");

  for (const section of data.sections) {
    lines.push(`## ${section.heading}`);
    for (const item of section.items) {
      const body = item.label ? `**${item.label}**: ${item.text}` : item.text;
      lines.push(`- ${body}`);
    }
    lines.push("");
  }

  if (data.missingInfo.length > 0) {
    lines.push("## 보완이 필요한 정보");
    for (const m of data.missingInfo) {
      lines.push(`- [${PRIORITY_LABEL[m.priority]}] ${m.question}`);
      lines.push(`  - 왜: ${m.why}`);
    }
    lines.push("");
  }

  if (data.notes) {
    lines.push("## 참고");
    lines.push(data.notes);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
