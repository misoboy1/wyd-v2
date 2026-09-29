import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-2xl border border-line bg-surface shadow-soft", className)} {...p} />
);
export function CardHeader({
  title,
  description,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <div className="mt-0.5 text-ink-3 [&_svg]:size-4.5">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export const CardBody = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn("px-5 pb-5", className)} {...p} />;
