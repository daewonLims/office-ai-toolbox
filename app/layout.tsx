import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { tools } from "@/lib/tools";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { getAvailableProviders } from "@/lib/ai";
import { ProviderProvider, ProviderSelect } from "@/components/provider-select";

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
        <aside className="w-full md:w-64 md:shrink-0 flex flex-col border-b md:border-b-0 md:border-r bg-muted/30 md:min-h-screen">
          <div className="px-4 py-4 md:py-6">
            <Link href="/" className="block text-lg font-semibold tracking-tight">
              Office AI Toolbox
            </Link>
          </div>
          <nav className="px-2 pb-4 md:flex-1">
            <ul className="flex flex-row flex-wrap gap-1 md:flex-col md:gap-0.5">
              {tools.map((tool) => {
                if (tool.status === "active") {
                  return (
                    <li key={tool.slug}>
                      <Link
                        href={tool.href}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <span>{tool.name}</span>
                      </Link>
                    </li>
                  );
                }
                return (
                  <li key={tool.slug}>
                    <div
                      aria-disabled="true"
                      className={cn(
                        "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                        "text-muted-foreground cursor-not-allowed select-none"
                      )}
                    >
                      <span>{tool.name}</span>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        준비 중
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-auto px-4 py-4 border-t">
            <ProviderSelect />
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
        <Toaster />
        </ProviderProvider>
      </body>
    </html>
  );
}
