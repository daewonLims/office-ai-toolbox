/**
 * handover-generator — self-contained tool module (인수인계서 생성).
 *
 * 다른 Next.js(App Router) 프로젝트로 이 폴더를 복사하려면 다음이 필요합니다:
 *   공유 모듈 (@/ alias):
 *     - @/lib/ai                     (getAvailableProviders, completeStructured) — 공유 AI 코어
 *     - @/components/provider-select (useProvider)
 *     - @/components/ui/*            shadcn/ui: badge, button, card, dialog, textarea
 *     - @/lib/utils                 (cn)
 *   npm 패키지:
 *     - zod, sonner, lucide-react, react, docx (.docx 다운로드)
 *   그리고 얇은 라우트(app/tools/handover-generator/page.tsx)에서 <HandoverGeneratorPage /> 렌더.
 *
 * 프라이버시: 이 도구는 성격상 입력한 업무 정보 전체를 서버 액션을 통해 LLM으로 전송합니다.
 * 앱은 입력·결과를 저장하지 않으며, 첫 생성 시 확인 다이얼로그로 명시합니다.
 * .docx 생성은 브라우저에서 수행합니다(docx 패키지 dynamic import).
 */
export { HandoverGeneratorPage } from "./components/handover-generator-page";
