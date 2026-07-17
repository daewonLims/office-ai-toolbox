/**
 * 생성된 인수인계서를 Word(.docx) 문서로 만든다.
 *
 * `docx` 패키지는 무겁고 브라우저에서만 쓰이므로 항상 dynamic import 한다.
 * - buildHandoverDocument: 순수 조립(노드/브라우저 공용, 테스트 가능)
 * - downloadHandoverDocx: 브라우저에서 Blob 생성 후 다운로드 트리거
 */
import type { HandoverResponse, MissingPriority } from "./schema";

const PRIORITY_LABEL: Record<MissingPriority, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
};

/** `YYYYMMDD` 형식의 오늘 날짜(로컬). */
export function todayStamp(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** docx Document 인스턴스를 조립한다(dynamic import). */
export async function buildHandoverDocument(data: HandoverResponse) {
  const {
    Document,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
  } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [];

  // 제목
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: data.title, bold: true })],
    })
  );
  children.push(new Paragraph({ text: "" }));

  // 본문 섹션
  for (const section of data.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: section.heading, bold: true })],
      })
    );
    for (const item of section.items) {
      const runs: InstanceType<typeof TextRun>[] = [];
      if (item.label) {
        runs.push(new TextRun({ text: `${item.label}: `, bold: true }));
      }
      runs.push(new TextRun({ text: item.text }));
      children.push(new Paragraph({ bullet: { level: 0 }, children: runs }));
    }
    children.push(new Paragraph({ text: "" }));
  }

  // 보완 필요 정보
  if (data.missingInfo.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "보완이 필요한 정보", bold: true })],
      })
    );
    for (const m of data.missingInfo) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({ text: `[${PRIORITY_LABEL[m.priority]}] `, bold: true }),
            new TextRun({ text: m.question }),
          ],
        })
      );
      children.push(
        new Paragraph({
          bullet: { level: 1 },
          children: [
            new TextRun({ text: `왜: ${m.why}`, italics: true, color: "666666" }),
          ],
        })
      );
    }
    children.push(new Paragraph({ text: "" }));
  }

  // 참고
  if (data.notes) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "참고", bold: true })],
      })
    );
    children.push(new Paragraph({ text: data.notes }));
  }

  return new Document({ sections: [{ children }] });
}

/** 브라우저에서 .docx Blob을 만들어 다운로드한다. */
export async function downloadHandoverDocx(
  data: HandoverResponse,
  filename = `인수인계서_${todayStamp()}.docx`
): Promise<void> {
  const { Packer } = await import("docx");
  const doc = await buildHandoverDocument(data);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
