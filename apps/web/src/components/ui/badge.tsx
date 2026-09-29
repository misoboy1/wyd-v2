import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  gray: "bg-surface-2 text-ink-2 border-line",
  blue: "bg-primary-soft text-primary-soft-ink border-transparent",
  red: "bg-bad-soft text-bad border-transparent",
  amber: "bg-warn-soft text-warn border-transparent",
  green: "bg-good-soft text-good border-transparent",
  gold: "bg-gold-soft text-gold border-transparent",
  outline: "bg-transparent text-ink-2 border-line-strong",
} as const;
export type Tone = keyof typeof tones;
export const Badge = ({ tone = "gray", className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[12px] leading-4 font-medium whitespace-nowrap [&_svg]:size-3",
      tones[tone],
      className,
    )}
    {...p}
  />
);
/** 성별 배지 (남=파랑, 여=주황) */
export const SexBadge = ({ sex }: { sex: string }) =>
  !sex ? <Badge tone="outline">성별?</Badge> : <Badge tone={sex === "남" ? "blue" : "amber"}>{sex}</Badge>;
/** 상태 배지 — 흔한 상태값 색 매핑 */
const STATUS_TONE: Record<string, Tone> = {
  확정: "green",
  입실: "blue",
  제안: "gray",
  변동중: "amber",
  대기: "gray",
  퇴실: "outline",
  가용: "green",
  사용중: "blue",
  점검중: "red",
};
export const StatusBadge = ({ status }: { status: string }) =>
  status ? <Badge tone={STATUS_TONE[status] ?? "gray"}>{status}</Badge> : null;
