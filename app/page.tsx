import Link from "next/link";
import { tools } from "@/lib/tools";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="px-6 py-10 md:px-10 md:py-16 max-w-5xl mx-auto">
      <section className="mb-10 md:mb-14">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          반복되는 사무 작업을 AI로 줄이세요
        </h1>
        <p className="mt-3 text-muted-foreground text-base md:text-lg">
          엑셀 취합부터 문서 정리까지, 손이 많이 가던 업무를 도구 하나로 빠르게
          처리하세요.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const isActive = tool.status === "active";

          const card = (
            <Card
              className={cn(
                "h-full transition-colors",
                isActive
                  ? "hover:border-primary/50 hover:bg-accent/40"
                  : "opacity-60 cursor-not-allowed"
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{tool.name}</CardTitle>
                  {!isActive && (
                    <Badge variant="secondary" className="shrink-0">
                      준비 중
                    </Badge>
                  )}
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          );

          if (isActive) {
            return (
              <Link key={tool.slug} href={tool.href} className="block">
                {card}
              </Link>
            );
          }

          return (
            <div key={tool.slug} aria-disabled="true">
              {card}
            </div>
          );
        })}
      </section>
    </div>
  );
}
