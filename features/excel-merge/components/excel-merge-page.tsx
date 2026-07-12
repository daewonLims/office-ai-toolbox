import { Badge } from "@/components/ui/badge";
import { MergeWizard } from "./merge-wizard";

export function ExcelMergePage() {
  return (
    <div className="px-6 py-10 md:px-10 md:py-16 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          엑셀 취합
        </h1>
        <Badge variant="secondary">베타</Badge>
      </div>

      <p className="mt-3 text-muted-foreground">
        양식이 제각각인 엑셀 파일들을 AI가 하나의 표준 양식으로 취합합니다
      </p>

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
        원본 데이터는 브라우저 밖으로 나가지 않습니다 — AI에는 컬럼명과 샘플 몇
        줄만 전송됩니다
        <br />값 통일 기능 사용 시(선택) 해당 컬럼의 고유값 목록이 추가로
        전송됩니다.
      </div>

      <MergeWizard />
    </div>
  );
}
