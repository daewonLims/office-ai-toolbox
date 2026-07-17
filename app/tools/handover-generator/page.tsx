import type { Metadata } from "next";
import { HandoverGeneratorPage } from "@/features/handover-generator";

export const metadata: Metadata = {
  title: "인수인계서 생성",
};

export default function Page() {
  return <HandoverGeneratorPage />;
}
