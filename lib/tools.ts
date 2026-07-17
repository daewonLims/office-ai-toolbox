import {
  Table2,
  Presentation,
  ListTree,
  FileText,
  GitCompare,
  type LucideIcon,
} from "lucide-react";

export type ToolStatus = "active" | "coming-soon";

/**
 * 도구가 AI API로 전송하는 텍스트 범위.
 * - minimal: 원본 전체는 보내지 않고 헤더·샘플·스타일 메타데이터 등 구조 정보만 전송
 * - full-text: 입력한 내용 전체를 AI에 전송
 */
export type AiDataScope = "minimal" | "full-text";

export interface Tool {
  slug: string;
  name: string;
  description: string;
  href: string;
  status: ToolStatus;
  aiDataScope: AiDataScope;
  icon: LucideIcon;
}

export const tools: Tool[] = [
  {
    slug: "excel-merge",
    name: "엑셀 취합",
    description:
      "양식이 제각각인 엑셀 파일들을 AI가 하나의 표준 양식으로 취합합니다",
    href: "/tools/excel-merge",
    status: "active",
    aiDataScope: "minimal",
    icon: Table2,
  },
  {
    slug: "ppt-lint",
    name: "PPT 린터",
    description: "발표 자료의 오탈자·서식·일관성을 AI가 점검합니다",
    href: "/tools/ppt-lint",
    status: "active",
    aiDataScope: "minimal",
    icon: Presentation,
  },
  {
    slug: "outline-converter",
    name: "개조식 변환기",
    description: "줄글을 보고서용 개조식 문장으로 자동 변환합니다",
    href: "/tools/outline-converter",
    status: "active",
    aiDataScope: "full-text",
    icon: ListTree,
  },
  {
    slug: "handover-generator",
    name: "인수인계서 생성",
    description: "업무 기록을 바탕으로 인수인계서 초안을 만듭니다",
    href: "/tools/handover-generator",
    status: "active",
    aiDataScope: "full-text",
    icon: FileText,
  },
  {
    slug: "doc-diff",
    name: "문서 버전 비교",
    description: "두 문서의 변경점을 의미 단위로 비교합니다",
    href: "/tools/doc-diff",
    status: "coming-soon",
    aiDataScope: "full-text",
    icon: GitCompare,
  },
];
