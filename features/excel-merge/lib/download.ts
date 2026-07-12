/**
 * 취합 결과 xlsx 생성 및 다운로드 (클라이언트 측 — server-only 아님).
 * ExcelJS는 항상 동적 import.
 */
import type { MergeOutput } from "./merge";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function stamp(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

export async function downloadMergedWorkbook(
  output: MergeOutput,
  date?: Date
): Promise<void> {
  // 브라우저 전용 가드 (빌드/서버 import 시 크래시 방지)
  if (typeof document === "undefined") return;

  const mod = await import("exceljs");
  const ExcelJS: any = (mod as any).default ?? mod;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("취합결과");

  const headerRow = ws.addRow(output.headers);
  headerRow.eachCell((cell: any) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
  });

  for (const row of output.rows) {
    ws.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `취합결과_${stamp(date ?? new Date())}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
