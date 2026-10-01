import type { ReactNode } from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/** 모달 — 모바일에서는 아래에서 올라오는 시트 형태 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const { t } = useT();
  const w = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" }[size];
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_.15s_ease-out]" />
        <D.Content
          onOpenAutoFocus={(e) => {
            const el = (e.target as HTMLElement).querySelector<HTMLElement>("[data-autofocus]");
            if (el) {
              e.preventDefault();
              el.focus();
            }
          }}
          className={cn(
            "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-surface shadow-pop outline-none",
            "inset-x-0 bottom-0 rounded-t-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            "data-[state=open]:animate-[slide-up_.2s_ease-out] sm:data-[state=open]:animate-[pop-in_.15s_ease-out]",
            w,
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-4 pb-3">
            <div className="min-w-0">
              <D.Title className="text-[16px] font-semibold text-ink">{title}</D.Title>
              {description ? (
                <D.Description className="mt-0.5 text-[13px] text-ink-3">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === "string" ? title : t("shell.ui.dialog")}</D.Description>
              )}
            </div>
            <D.Close className="-mr-1 rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={t("common.close")}>
              <X className="size-4.5" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
