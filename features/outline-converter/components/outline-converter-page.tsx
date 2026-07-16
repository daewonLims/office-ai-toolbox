import { Badge } from "@/components/ui/badge";
import { OutlineConverter } from "./outline-converter";

export function OutlineConverterPage() {
  return (
    <div className="px-6 py-10 md:px-10 md:py-16 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          개조식 변환기
        </h1>
        <Badge variant="secondary">베타</Badge>
      </div>

      <p className="mt-3 text-muted-foreground">
        서술식(줄글)과 보고서용 개조식(□ ○ 계층·명사형 종결) 문체를 서로
        변환합니다. 붙여넣고, 변환하고, 원문과 나란히 비교해 복사하세요.
      </p>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        이 도구는 입력한 텍스트를 선택한 AI 프로바이더에 전송합니다 — 변환
        기능의 본질상 텍스트 자체가 필요합니다.
        <br />
        전송된 텍스트는 이 앱의 서버에 저장되지 않으며, 변환 목적 외에 사용되지
        않습니다. 회사 기밀·개인정보가 포함된 텍스트는 조직의 보안 정책을 확인한
        뒤 사용하세요.
      </div>

      <OutlineConverter />
    </div>
  );
}
