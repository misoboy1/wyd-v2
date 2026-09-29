import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-primary text-primary-ink hover:brightness-110 shadow-soft",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2 shadow-soft",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  soft: "bg-primary-soft text-primary-soft-ink hover:brightness-95",
  danger: "bg-bad text-white hover:brightness-110 shadow-soft",
  "danger-ghost": "text-bad hover:bg-bad-soft",
} as const;
const sizes = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-9.5 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
  "icon-sm": "h-7.5 w-7.5 rounded-md",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", loading, disabled, children, ...p }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background,filter,color] select-none disabled:opacity-50 disabled:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...p}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
