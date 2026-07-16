"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * 첫 사용 확인 다이얼로그.
 * 사용자가 처음 "변환하기"를 누를 때 한 번 더 명시적으로 동의를 받는다.
 * "다시 표시하지 않기" 체크 시 이후 생략(호출부에서 localStorage 저장).
 */
export function ConsentDialog({
  open,
  onOpenChange,
  providerLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerLabel: string;
  onConfirm: (dontShowAgain: boolean) => void;
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            텍스트가 AI로 전송됩니다
          </DialogTitle>
          <DialogDescription>
            이 도구는 변환을 위해 입력한 텍스트를 선택한 AI 프로바이더로
            전송합니다. 전송된 텍스트는 이 앱의 서버에 저장되지 않으며, 변환
            목적 외에는 사용되지 않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          전송 대상 프로바이더:{" "}
          <span className="font-semibold">{providerLabel}</span>
          <br />
          회사 기밀·개인정보가 포함된 텍스트는 조직의 보안 정책을 확인한 뒤
          사용하세요.
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          다시 표시하지 않기
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={() => onConfirm(dontShowAgain)}>
            이해했어요, 변환 진행
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
