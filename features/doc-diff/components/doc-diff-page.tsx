import { Badge } from "@/components/ui/badge";
import { DocDiff } from "./doc-diff";

export function DocDiffPage() {
  return (
    <div className="px-6 py-10 md:px-10 md:py-16 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          문서 버전 비교
        </h1>
        <Badge variant="secondary">베타</Badge>
      </div>

      <p className="mt-3 text-muted-foreground">
        &lsquo;최종_진짜최종.docx&rsquo; 두 버전을 문단 단위로 비교해 무엇이
        추가·삭제·수정됐는지 보여줍니다. 필요하면 변경 내용을 AI가 의미 단위로
        요약합니다.
      </p>

      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
        문단 비교는 전부 브라우저 안에서 처리됩니다 — .docx 파싱도, 변경 계산도
        서버로 전송되지 않습니다.
        <br />
        AI 요약(선택)을 실행할 때만 <span className="font-semibold">변경된
        문단의 원문·수정문</span>이 전송되며, 변경되지 않은 문단과 파일 원본은
        전송되지 않습니다.
      </div>

      <DocDiff />
    </div>
  );
}
