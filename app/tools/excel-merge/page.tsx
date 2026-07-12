import type { Metadata } from "next";
import { ExcelMergePage } from "@/features/excel-merge";

export const metadata: Metadata = {
  title: "엑셀 취합",
};

export default function Page() {
  return <ExcelMergePage />;
}
