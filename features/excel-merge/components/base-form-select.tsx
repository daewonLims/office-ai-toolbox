"use client";

import { FileSpreadsheet } from "lucide-react";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { ParsedSheet } from "../lib/types";

export function BaseFormSelect({
  sheets,
  value,
  onChange,
}: {
  sheets: ParsedSheet[];
  value: string | null;
  onChange: (fileName: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        다른 파일들의 컬럼을 이 파일의 양식에 맞춰 취합합니다.
      </p>

      <RadioGroup
        value={value ?? ""}
        onValueChange={(next) => onChange(next as string)}
        className="gap-3 sm:grid-cols-2"
      >
        {sheets.map((sheet) => {
          const selected = sheet.fileName === value;
          return (
            <label
              key={sheet.fileName}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/40"
              )}
            >
              <RadioGroupItem value={sheet.fileName} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                  <span
                    className="truncate text-sm font-medium"
                    title={sheet.fileName}
                  >
                    {sheet.fileName}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sheet.rowCount.toLocaleString()}행 · 컬럼{" "}
                  {sheet.headers.length}개
                </p>
                {sheet.headers.length > 0 && (
                  <p
                    className="mt-1 truncate text-xs text-muted-foreground"
                    title={sheet.headers.join(", ")}
                  >
                    {sheet.headers.slice(0, 5).join(" · ")}
                    {sheet.headers.length > 5 ? " …" : ""}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
