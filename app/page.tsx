import Link from "next/link";
import { tools, type AiDataScope } from "@/lib/tools";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const AI_SCOPE_BADGE: Record<
  AiDataScope,
  { label: string; className: string; hint: string; desc: string }
> = {
  minimal: {
    label: "원본 미전송",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    hint: "AI에는 구조 정보만 전송",
    desc: "원본은 보내지 않고 헤더·샘플 등 구조 정보만 AI에 전송합니다.",
  },
  "full-text": {
    label: "입력 내용 AI 전송",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    hint: "입력한 내용 전체가 AI로 전송",
    desc: "입력한 내용 전체가 AI로 전송됩니다.",
  },
};

const SCOPE_ORDER: AiDataScope[] = ["minimal", "full-text"];

export default function Home() {
  return (
    <div className="px-6 py-12 md:px-10 md:py-20 max-w-5xl mx-auto">
      {/* Hero */}
      <section className="relative mb-14 md:mb-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-28 -z-10 h-72"
          style={{
            background:
              "radial-gradient(46% 60% at 30% 30%, rgba(245,158,11,0.13), transparent 72%)",
          }}
        />
        <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Office AI Toolbox
        </div>
        <h1 className="mt-5 max-w-2xl text-3xl md:text-5xl font-semibold tracking-tight text-balance break-keep">
          반복되는 사무 작업을
          <br className="hidden sm:block" /> AI로 줄이세요
        </h1>
        <p className="mt-4 max-w-xl text-base md:text-lg text-muted-foreground text-pretty break-keep">
          엑셀 취합부터 문서 정리까지, 손이 많이 가던 업무를 도구 하나로 빠르게
          처리하세요.
        </p>
      </section>

      {/* Tools */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const isActive = tool.status === "active";
          const scope = AI_SCOPE_BADGE[tool.aiDataScope];

          const card = (
            <Card
              className={cn(
                "group/card h-full gap-0 ring-1 transition-all duration-200",
                isActive
                  ? "ring-foreground/10 hover:-translate-y-0.5 hover:ring-amber-500/40 hover:shadow-sm"
                  : "ring-foreground/10 opacity-60"
              )}
            >
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold">
                    {tool.name}
                  </CardTitle>
                  {!isActive && (
                    <Badge variant="secondary" className="shrink-0">
                      준비 중
                    </Badge>
                  )}
                </div>
                <CardDescription className="min-h-10 text-sm leading-relaxed text-muted-foreground break-keep">
                  {tool.description}
                </CardDescription>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Badge
                    className={cn(
                      "border-transparent px-1.5 py-0 text-[11px] font-medium",
                      scope.className
                    )}
                    title={scope.hint}
                  >
                    {scope.label}
                  </Badge>
                  {isActive && (
                    <span
                      aria-hidden
                      className="text-base text-muted-foreground transition-transform duration-200 group-hover/card:translate-x-0.5 group-hover/card:text-amber-500"
                    >
                      →
                    </span>
                  )}
                </div>
              </CardHeader>
            </Card>
          );

          if (isActive) {
            return (
              <Link
                key={tool.slug}
                href={tool.href}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              >
                {card}
              </Link>
            );
          }

          return (
            <div key={tool.slug} aria-disabled="true" className="cursor-not-allowed">
              {card}
            </div>
          );
        })}
      </section>

      {/* Badge legend — quiet footnote */}
      <section className="mt-14 border-t pt-6">
        <h2 className="text-xs font-medium text-muted-foreground">배지 안내</h2>
        <ul className="mt-3 space-y-2">
          {SCOPE_ORDER.map((key) => {
            const scope = AI_SCOPE_BADGE[key];
            return (
              <li key={key} className="flex items-start gap-2.5">
                <Badge
                  className={cn(
                    "mt-0.5 shrink-0 border-transparent px-1.5 py-0 text-[11px] font-medium",
                    scope.className
                  )}
                >
                  {scope.label}
                </Badge>
                <span className="text-xs leading-relaxed text-muted-foreground break-keep">
                  {scope.desc}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground break-keep">
          자세한 기준은 README의 &lsquo;도구별 AI 전송 범위&rsquo;를 참고하세요.
        </p>
      </section>
    </div>
  );
}
