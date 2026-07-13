/**
 * ppt-lint — self-contained tool module (PPT 린터).
 *
 * 다른 Next.js(App Router) 프로젝트로 이 폴더를 복사하려면 다음이 필요합니다:
 *   공유 모듈 (@/ alias):
 *     - @/lib/ai                     (getAvailableProviders, completeStructured) — 공유 AI 코어
 *     - @/components/provider-select (useProvider)
 *     - @/components/ui/*            shadcn/ui: badge, card, button
 *     - @/lib/utils                 (cn)
 *   npm 패키지:
 *     - jszip, fast-xml-parser, zod, sonner, lucide-react, react
 *   그리고 얇은 라우트(app/tools/ppt-lint/page.tsx)에서 <PptLintPage /> 렌더.
 *
 * 검사·리포트는 전부 클라이언트(브라우저)에서 수행되고, actions.ts의 AI 요약만
 * 서버에서 실행됩니다. 원본 .pptx는 브라우저를 떠나지 않습니다.
 */
export { PptLintPage } from "./components/ppt-lint-page";
