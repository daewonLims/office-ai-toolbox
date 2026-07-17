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
 * 첫 생성 확인 다이얼로그.
 * 사용자가 처음 "인수인계서 생성"을 누를 때 한 번 더 명시적으로 동의를 받는다.
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
            입력한 업무 정보가 AI로 전송됩니다
          </DialogTitle>
          <DialogDescription>
            이 도구는 인수인계서 작성을 위해 입력한 업무 정보 전체를 선택한 AI
            프로바이더로 전송합니다. 전송된 내용은 이 앱의 서버에 저장되지 않으며,
            문서 생성 목적 외에는 사용되지 않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          전송 대상 프로바이더:{" "}
          <span className="font-semibold">{providerLabel}</span>
          <br />
          비밀번호 등 실제 자격증명은 입력하지 마세요. 회사 기밀·개인정보가
          포함된 내용은 조직의 보안 정책을 확인한 뒤 사용하세요.
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
            이해했어요, 생성 진행
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
