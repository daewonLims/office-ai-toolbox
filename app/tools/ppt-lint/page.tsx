import type { Metadata } from "next";
import { PptLintPage } from "@/features/ppt-lint";

export const metadata: Metadata = {
  title: "PPT 린터",
};

export default function Page() {
  return <PptLintPage />;
}
