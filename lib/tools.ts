export type ToolStatus = "active" | "coming-soon";

export interface Tool {
  slug: string;
  name: string;
  description: string;
  href: string;
  status: ToolStatus;
}

export const tools: Tool[] = [
  {
    slug: "excel-merge",
    name: "엑셀 취합",
    description:
      "양식이 제각각인 엑셀 파일들을 AI가 하나의 표준 양식으로 취합합니다",
    href: "/tools/excel-merge",
    status: "active",
  },
  {
    slug: "ppt-linter",
    name: "PPT 린터",
    description: "발표 자료의 오탈자·서식·일관성을 AI가 점검합니다",
    href: "/tools/ppt-linter",
    status: "coming-soon",
  },
  {
    slug: "outline-converter",
    name: "개조식 변환기",
    description: "줄글을 보고서용 개조식 문장으로 자동 변환합니다",
    href: "/tools/outline-converter",
    status: "coming-soon",
  },
  {
    slug: "handover-generator",
    name: "인수인계서 생성",
    description: "업무 기록을 바탕으로 인수인계서 초안을 만듭니다",
    href: "/tools/handover-generator",
    status: "coming-soon",
  },
  {
    slug: "doc-diff",
    name: "문서 버전 비교",
    description: "두 문서의 변경점을 의미 단위로 비교합니다",
    href: "/tools/doc-diff",
    status: "coming-soon",
  },
];
