/**
 * outline-converter — self-contained tool module (개조식 변환기).
 *
 * 다른 Next.js(App Router) 프로젝트로 이 폴더를 복사하려면 다음이 필요합니다:
 *   공유 모듈 (@/ alias):
 *     - @/lib/ai                     (getAvailableProviders, completeStructured) — 공유 AI 코어
 *     - @/components/provider-select (useProvider)
 *     - @/components/ui/*            shadcn/ui: badge, button, card, dialog, radio-group, textarea
 *     - @/lib/utils                 (cn)
 *   npm 패키지:
 *     - zod, sonner, lucide-react, react
 *   그리고 얇은 라우트(app/tools/outline-converter/page.tsx)에서 <OutlineConverterPage /> 렌더.
 *
 * 프라이버시: 이 도구는 성격상 입력 텍스트 전체를 서버 액션을 통해 LLM으로 전송합니다.
 * (변환 기능의 본질) 앱은 텍스트를 저장하지 않으며, 첫 사용 시 확인 다이얼로그로 명시합니다.
 * 계층 기호(□ ○ - 등)는 LLM이 아니라 클라이언트(lib/markers.ts)가 결정적으로 부여합니다.
 */
export { OutlineConverterPage } from "./components/outline-converter-page";
