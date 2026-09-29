import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-ink [&_svg]:size-5">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13.5px] text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, children, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      {icon && <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-3 [&_svg]:size-5">{icon}</div>}
      <div className="text-[14.5px] font-medium text-ink-2">{title}</div>
      {children && <div className="max-w-md text-[13px] text-ink-3">{children}</div>}
    </div>
  );
}

/** KPI 타일 — 큰 숫자 + 라벨 */
export function Stat({ label, value, hint, tone, icon, onClick, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "primary" | "good" | "warn" | "bad" | "gold"; icon?: ReactNode; onClick?: () => void; className?: string }) {
  const color = tone ? { primary: "text-primary", good: "text-good", warn: "text-warn", bad: "text-bad", gold: "text-gold" }[tone] : "text-ink";
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={cn("rounded-2xl border border-line bg-surface p-4 text-left shadow-soft", onClick && "transition hover:border-line-strong hover:shadow-card", className)}>
      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 [&_svg]:size-3.5">{icon}{label}</div>
      <div className={cn("mt-1.5 text-[26px] leading-none font-bold tracking-tight tabular", color)}>{value}</div>
      {hint && <div className="mt-1.5 text-[12px] text-ink-3">{hint}</div>}
    </Comp>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} />;

/** 세그먼트 토글(필터 등) */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cn("inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface-2 p-0.5", className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn("inline-flex h-7.5 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition",
            value === o.value ? "bg-surface text-ink shadow-soft" : "text-ink-3 hover:text-ink")}>
          {o.label}{o.count != null && <span className="tabular text-[11.5px] text-ink-3">{o.count.toLocaleString()}</span>}
        </button>
      ))}
    </div>
  );
}

/** 진행 막대 */
export function Progress({ value, max = 100, className, tone = "primary" }: { value: number; max?: number; className?: string; tone?: "primary" | "good" | "warn" | "bad" }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bg = { primary: "bg-primary", good: "bg-good", warn: "bg-warn", bad: "bg-bad" }[tone];
  return <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}><div className={cn("h-full rounded-full transition-[width]", bg)} style={{ width: pct + "%" }} /></div>;
}
