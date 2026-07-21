/**
 * doc-diff — self-contained tool module (문서 버전 비교).
 *
 * 다른 Next.js(App Router) 프로젝트로 이 폴더를 복사하려면 다음이 필요합니다:
 *   공유 모듈 (@/ alias):
 *     - @/lib/ai                     (getAvailableProviders, completeStructured) — 공유 AI 코어
 *     - @/lib/safe-zip               (openZip, SafeZipError) — 악성 zip 방어 공유 코어
 *     - @/components/provider-select (useProvider)
 *     - @/components/ui/*            shadcn/ui: badge, button, card, dialog, textarea
 *     - @/lib/utils                 (cn)
 *   npm 패키지:
 *     - jszip, fast-xml-parser, zod, sonner, lucide-react, react
 *   그리고 얇은 라우트(app/tools/doc-diff/page.tsx)에서 <DocDiffPage /> 렌더.
 *
 * 문단 비교(추가/삭제/수정 + 인라인 하이라이트)는 전부 클라이언트에서 수행됩니다.
 * .docx 파싱도 브라우저에서만 이뤄지고, 원본 파일은 브라우저를 떠나지 않습니다.
 * actions.ts의 AI 요약(선택)만 서버에서 실행되며, 이때도 '변경된 문단의
 * 원문·수정문'만 전송하고 변경되지 않은 문단은 전송하지 않습니다.
 */
export { DocDiffPage } from "./components/doc-diff-page";
