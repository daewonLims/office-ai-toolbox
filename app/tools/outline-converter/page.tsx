import type { Metadata } from "next";
import { OutlineConverterPage } from "@/features/outline-converter";

export const metadata: Metadata = {
  title: "개조식 변환기",
};

export default function Page() {
  return <OutlineConverterPage />;
}
