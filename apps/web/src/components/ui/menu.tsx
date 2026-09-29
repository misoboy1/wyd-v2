import type { ReactNode } from "react";
import { DropdownMenu as M, Popover as P, Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

export function Menu({ trigger, children, align = "end" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content align={align} sideOffset={6} className="z-50 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-pop">{children}</M.Content>
      </M.Portal>
    </M.Root>
  );
}
export function MenuItem({ children, onSelect, danger, icon, disabled }: { children: ReactNode; onSelect?: () => void; danger?: boolean; icon?: ReactNode; disabled?: boolean }) {
  return (
    <M.Item disabled={disabled} onSelect={onSelect}
      className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3",
        danger ? "text-bad [&_svg]:text-bad" : "text-ink")}>
      {icon}{children}
    </M.Item>
  );
}
export const MenuSep = () => <M.Separator className="my-1 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <M.Label className="px-2.5 pt-1.5 pb-1 text-[12px] font-medium text-ink-3">{children}</M.Label>;

export function Popover({ trigger, children, className, align = "start", open, onOpenChange }: { trigger: ReactNode; children: ReactNode; className?: string; align?: "start" | "end" | "center"; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content align={align} sideOffset={6} className={cn("z-50 rounded-xl border border-line bg-surface p-2 shadow-pop outline-none", className)}>{children}</P.Content>
      </P.Portal>
    </P.Root>
  );
}

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content sideOffset={6} className="z-50 max-w-72 rounded-lg bg-ink px-2.5 py-1.5 text-[12.5px] leading-snug text-bg shadow-pop">{content}</T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
