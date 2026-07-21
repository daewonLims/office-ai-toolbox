import type { Metadata } from "next";
import { DocDiffPage } from "@/features/doc-diff";

export const metadata: Metadata = {
  title: "문서 버전 비교",
};

export default function Page() {
  return <DocDiffPage />;
}
