import { useState, type ReactNode } from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { tt, useT } from "@/lib/i18n";

interface Opts {
  title: ReactNode;
  body?: ReactNode;
  confirmText?: string;
  danger?: boolean;
  /** 이 단어를 입력해야 실행(되돌릴 수 없는 작업) */ typeToConfirm?: string;
}
type Pending = Opts & { resolve: (v: boolean) => void };
let push: ((p: Pending) => void) | null = null;

/** await confirm({...}) → true/false */
export function confirm(o: Opts): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(window.confirm(typeof o.title === "string" ? o.title : tt("shell.ui.continueQ")));
    push({ ...o, resolve });
  });
}

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const { t } = useT();
  push = (x) => {
    setTyped("");
    setP(x);
  };
  const close = (v: boolean) => {
    p?.resolve(v);
    setP(null);
  };
  const blocked = !!p?.typeToConfirm && typed.trim() !== p.typeToConfirm;
  return (
    <Dialog
      open={!!p}
      onOpenChange={(o) => !o && close(false)}
      title={p?.title ?? ""}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant={p?.danger ? "danger" : "primary"} disabled={blocked} onClick={() => close(true)}>
            {p?.confirmText ?? t("common.confirm")}
          </Button>
        </>
      }
    >
      {p?.body && <div className="text-[14px] leading-relaxed text-ink-2">{p.body}</div>}
      {p?.typeToConfirm && (
        <div className="mt-3">
          <p className="mb-1.5 text-[13px] text-ink-3">
            {(() => {
              // 문장 속 {word} 자리에 굵은 글씨를 끼워 넣는다(언어별 어순 유지)
              const [a, b = ""] = t("shell.ui.typeToConfirm", { word: "\u0001" }).split("\u0001");
              return (
                <>
                  {a}
                  <b className="text-ink">{p.typeToConfirm}</b>
                  {b}
                </>
              );
            })()}
          </p>
          <Input
            data-autofocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !blocked) close(true);
            }}
          />
        </div>
      )}
    </Dialog>
  );
}
