import { Badge } from "@/components/ui/badge";
import { PptLinter } from "./ppt-linter";

export function PptLintPage() {
  return (
    <div className="px-6 py-10 md:px-10 md:py-16 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">PPT 린터</h1>
        <Badge variant="secondary">베타</Badge>
      </div>

      <p className="mt-3 text-muted-foreground">
        코드 린터처럼, 발표 자료(.pptx)의 글꼴·색상·정렬·바닥글 불일치를 슬라이드별로
        검사해 리포트로 보여줍니다. (검사·리포트 전용 — 파일을 수정하지 않습니다)
      </p>

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
        파일은 브라우저 안에서만 분석됩니다 — 원본은 서버로 전송되지 않습니다.
        <br />
        AI 요약 사용 시(선택) 폰트·색상 등 스타일 정보와 위반 통계만 전송됩니다.
        (슬라이드 본문 텍스트는 전송되지 않습니다.)
      </div>

      <PptLinter />
    </div>
  );
}
