"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { tools } from "@/lib/tools";
import { Badge } from "@/components/ui/badge";
import { ProviderSelect } from "@/components/provider-select";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "office-ai-toolbox:sidebar-collapsed";

// mounted flag without an effect: false during SSR + hydration, true after.
const subscribeMounted = () => () => {};

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  };

  // Collapse takes visual effect at md+ only (sm stays a top menu bar).
  const isCollapsed = mounted && collapsed;

  return (
    <aside
      className={cn(
        "w-full md:shrink-0 flex flex-col border-b md:border-b-0 md:border-r bg-muted/30 md:min-h-screen md:relative",
        "transition-[width] duration-200",
        isCollapsed ? "md:w-16" : "md:w-64"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-4 md:py-6",
          isCollapsed && "md:flex-col md:px-0"
        )}
      >
        <Link
          href="/"
          className={cn(
            "text-lg font-semibold tracking-tight",
            isCollapsed ? "md:hidden" : "block"
          )}
        >
          Office AI Toolbox
        </Link>
        {isCollapsed && (
          <Link
            href="/"
            aria-label="Office AI Toolbox 홈"
            title="Office AI Toolbox"
            className="hidden h-8 w-8 items-center justify-center rounded-md md:flex"
          >
            <Image
              src="/icon.svg"
              alt=""
              width={28}
              height={28}
              unoptimized
              className="rounded-md"
            />
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
          className={cn(
            "hidden h-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:inline-flex",
            isCollapsed
              ? // 접힘: 레일 폭은 유지한 채, 홈 아이콘과 같은 줄 높이에서
                // 사이드바 우측 경계 밖으로 튀어나온 패널 탭 형태로 고정
                "md:absolute md:left-full md:top-6 md:z-20 md:w-6 md:rounded-l-none md:rounded-r-md md:border md:border-l-0 md:bg-background md:shadow-sm"
              : "ml-auto w-8 rounded-md"
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
      <nav className="px-2 pb-4 md:flex-1">
        <ul className="flex flex-row flex-wrap gap-1 md:flex-col md:gap-0.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            if (tool.status === "active") {
              const active = pathname === tool.href;
              return (
                <li key={tool.slug}>
                  <Link
                    href={tool.href}
                    title={tool.name}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                      isCollapsed && "md:justify-center md:px-0"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className={cn(isCollapsed && "md:hidden")}>
                      {tool.name}
                    </span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={tool.slug}>
                <div
                  aria-disabled="true"
                  title={tool.name}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground cursor-not-allowed select-none",
                    isCollapsed && "md:justify-center md:px-0"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn(isCollapsed && "md:hidden")}>
                    {tool.name}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-auto shrink-0",
                      isCollapsed && "md:hidden"
                    )}
                  >
                    준비 중
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>
      <div
        className={cn(
          "mt-auto px-4 py-4 border-t",
          isCollapsed && "md:hidden"
        )}
      >
        <ProviderSelect />
      </div>
    </aside>
  );
}
