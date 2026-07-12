/**
 * excel-merge — self-contained tool module.
 *
 * To copy this folder into another Next.js (App Router) project, that project must provide:
 *   External shared modules (imported via @/ alias):
 *     - @/lib/ai                 (getAvailableProviders, completeStructured)  — shared AI core
 *     - @/components/provider-select (useProvider)
 *     - @/components/ui/*        shadcn/ui: badge, radio-group, alert, card, select, switch, table, button, progress
 *     - @/lib/utils             (cn)
 *   npm packages:
 *     - exceljs, zod, sonner, lucide-react, react
 *   And a thin route (e.g. app/tools/excel-merge/page.tsx) that renders <ExcelMergePage />.
 */
export { ExcelMergePage } from "./components/excel-merge-page";
