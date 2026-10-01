import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

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
export function SexBadge({ sex }: { sex: string }) {
  const { t, label } = useT();
  return !sex ? (
    <Badge tone="outline">{t("shell.ui.sexUnknown")}</Badge>
  ) : (
    <Badge tone={sex === "남" ? "blue" : "amber"}>{label("sex", sex)}</Badge>
  );
}
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
export function StatusBadge({ status }: { status: string }) {
  const { label } = useT();
  if (!status) return null;
  // 상태값은 방문자·가정·시설 공용 → 사전에 있는 그룹의 라벨 사용(없으면 원문)
  const groups = ["visitorStatus", "homestayStatus", "facilityStatus"] as const;
  const text = groups.map((g) => label(g, status)).find((l) => l !== status) ?? status;
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{text}</Badge>;
}
