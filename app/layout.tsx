import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { getAvailableProviders } from "@/lib/ai";
import { ProviderProvider } from "@/components/provider-select";
import { Sidebar } from "@/components/sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Office AI Toolbox",
  description: "반복되는 사무 작업을 AI로 줄여주는 도구 모음",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const providers = getAvailableProviders();
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col md:flex-row">
        <ProviderProvider providers={providers}>
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
          <Toaster />
        </ProviderProvider>
      </body>
    </html>
  );
}
