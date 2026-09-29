// 공지·게시판·Q&A 공용 카드와 목록 도우미
import type { ReactNode } from "react";
import { CalendarDays, UserRound } from "lucide-react";
import { todayKST } from "@wyd/shared";
import { Badge } from "@/components/ui/badge";
import { cn, daysBetween } from "@/lib/utils";

/** 최신순(날짜 → id) */
export const newestFirst = <T extends { date: string; id: number }>(a: T, b: T) => String(b.date).localeCompare(String(a.date)) || b.id - a.id;

/** 3일 이내 글이면 NEW */
export function isNew(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date || "")) return false;
  const d = daysBetween(date.slice(0, 10), todayKST());
  return d >= 0 && d <= 3;
}

export function Meta({ date, author, children }: { date?: string; author?: string; children?: ReactNode }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
      {date && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{date}</span>}
      {author && <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" />{author}</span>}
      {children}
    </div>
  );
}

export function BoardCard({ title, date, author, body, badges, actions, accent, children, className }: {
  title: ReactNode; date?: string; author?: string; body?: string; badges?: ReactNode; actions?: ReactNode; accent?: boolean; children?: ReactNode; className?: string;
}) {
  return (
    <article className={cn("rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5", accent && "border-l-4 border-l-primary", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {badges}
            <h3 className="text-[15.5px] leading-snug font-semibold break-words text-ink">{title}</h3>
            {date && isNew(date) && <Badge tone="red">NEW</Badge>}
          </div>
          <Meta date={date} author={author} />
        </div>
        {actions && <div className="-mt-1 -mr-1 flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {body && <div className="mt-3 text-[14px] leading-relaxed break-words whitespace-pre-wrap text-ink-2">{body}</div>}
      {children}
    </article>
  );
}
