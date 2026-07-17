import { Badge } from "@/components/ui/badge";
import { HandoverGenerator } from "./handover-generator";

export function HandoverGeneratorPage() {
  return (
    <div className="px-6 py-10 md:px-10 md:py-16 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          인수인계서 생성
        </h1>
        <Badge variant="secondary">베타</Badge>
      </div>

      <p className="mt-3 text-muted-foreground">
        퇴사·부서이동 시 필요한 인수인계서를 AI가 표준 구조로 정리합니다. 아는
        만큼 자유롭게 적으면, 빠진 정보는 체크리스트로 짚어줍니다.
      </p>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        이 도구는 입력한 업무 정보 전체를 선택한 AI 프로바이더에 전송합니다 —
        문서 정리 기능의 본질상 내용 자체가 필요합니다.
        <br />
        전송된 내용은 이 앱의 서버에 저장되지 않습니다.{" "}
        <span className="font-semibold">
          비밀번호 등 실제 자격증명은 입력하지 마세요.
        </span>{" "}
        회사 기밀·개인정보가 포함된 내용은 조직의 보안 정책을 확인한 뒤
        사용하세요.
      </div>

      <HandoverGenerator />
    </div>
  );
}
