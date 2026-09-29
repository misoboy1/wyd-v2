// 숙소 화면 공용 작은 조각 — 연락처, 상태 배지, 가족 구성 칩, 정렬 머리글, 쪽 나누기
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { famText, reqSex, SCALE, type Homestay } from "@wyd/shared";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn, isBrokenTel, num, telHref } from "@/lib/utils";

/** 연락처 — 시트 수식 오류(#ERROR! 등)는 재입력 경고 */
export function Tel({ tel }: { tel?: string }) {
  const v = String(tel ?? "");
  if (!v) return <span className="text-ink-3">—</span>;
  if (v.includes("••••")) return <span className="text-ink-3">{v}</span>;
  if (isBrokenTel(v) || /^#(REF|N\/A)/i.test(v))
    return <span className="text-[12px] whitespace-nowrap text-bad" title="시트에서 +로 시작하는 번호가 수식으로 인식되어 깨졌습니다. 편집에서 다시 입력하세요.">⚠ 연락처 오류(재입력)</span>;
  return <a href={telHref(v)} className="whitespace-nowrap text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{v}</a>;
}

export const Dash = () => <span className="text-ink-3">—</span>;
export const VisStatus = ({ s }: { s: string }) => <Badge tone={s === "변동중" ? "amber" : s === "대기" ? "gray" : "green"}>{s || "—"}</Badge>;
export const FacStatus = ({ s }: { s: string }) => s ? <Badge tone={s === "가용" ? "green" : s === "사용중" ? "blue" : "amber"}>{s}</Badge> : <Dash />;
export const HsStatus = ({ s }: { s: string }) => s ? <Badge tone={s === "입실" ? "green" : s === "확정" ? "blue" : s === "퇴실" ? "gray" : "amber"}>{s}</Badge> : <Dash />;
export const SexTag = ({ sex }: { sex: string }) => sex ? <Badge tone={sex === "남" ? "blue" : sex === "여" ? "amber" : "gray"}>{sex}</Badge> : <Dash />;
export function ReqSexBadge({ h }: { h: Homestay }) {
  const rs = reqSex(h);
  return rs === "—" ? <Dash /> : <Badge tone={rs === "남" ? "blue" : rs === "여" ? "amber" : "gray"}>{rs}</Badge>;
}

/** 가족 인원 칩(성인=회색, 남=파랑, 여=주황) — 기존 famBadges */
export function FamBadges({ h }: { h: Homestay }) {
  const items: [string, number, Tone][] = ([
    ["성인남", Number(h.mAdult) || 0, "gray"], ["성인여", Number(h.fAdult) || 0, "gray"],
    ["남학생", Number(h.mStu) || 0, "blue"], ["여학생", Number(h.fStu) || 0, "amber"],
    ["남청년", Number(h.mYng) || 0, "blue"], ["여청년", Number(h.fYng) || 0, "amber"],
  ] as [string, number, Tone][]).filter((x) => x[1] > 0);
  if (!items.length) { const t = famText(h, false); return t === "—" ? <Dash /> : <span className="text-[12.5px]">{t}</span>; }
  const total = items.reduce((s, x) => s + x[1], 0);
  return (
    <div className="flex min-w-36 flex-wrap items-center gap-1">
      {items.map(([l, n, t]) => <Badge key={l} tone={t} className="text-[11px]">{l} {n}</Badge>)}
      <span className="text-[11.5px] font-semibold text-ink-3">계 {total}</span>
    </div>
  );
}

/** 정렬 머리글 버튼(쪽 나누기와 함께 쓰려고 표 밖에서 정렬) */
export interface SortState<K extends string> { key: K; dir: 1 | -1 }
export function SortHead<K extends string>({ k, label, sort, onSort, sub }: { k: K; label: ReactNode; sort: SortState<K>; onSort: (s: SortState<K>) => void; sub?: ReactNode }) {
  const on = sort.key === k;
  return (
    <button type="button" onClick={() => onSort({ key: k, dir: on ? (-sort.dir as 1 | -1) : 1 })}
      className={cn("inline-flex flex-col items-start text-left hover:text-ink", on && "text-ink")} aria-label={`${typeof label === "string" ? label : ""} 정렬`}>
      <span className="inline-flex items-center gap-1">{label}
        {on ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}</span>
      {sub && <span className="text-[11px] font-normal text-ink-3">{sub}</span>}
    </button>
  );
}

/** 쪽 나누기 — 50/100/200/전체 */
export function usePage(total: number, page: number, size: number) {
  const pages = size ? Math.max(1, Math.ceil(total / size)) : 1;
  const p = Math.min(Math.max(1, page), pages);
  return { p, pages, start: size ? (p - 1) * size : 0, end: size ? Math.min(total, p * size) : total };
}
export function Pager({ total, unit, page, size, onPage, onSize }: { total: number; unit: string; page: number; size: number; onPage: (p: number) => void; onSize: (s: number) => void }) {
  const pg = usePage(total, page, size);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
      <span className="tabular">{total ? `${num(pg.start + 1)}–${num(pg.end)} / ${num(total)}${unit}` : `0${unit}`}</span>
      <span className="flex-1" />
      {pg.pages > 1 && (
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="이전 쪽" disabled={pg.p <= 1} onClick={() => onPage(pg.p - 1)}><ChevronLeft /></Button>
          <Select aria-label="쪽 선택" className="h-8 w-28 text-[13px]" value={pg.p} onChange={(e) => onPage(Number(e.target.value))}>
            {Array.from({ length: pg.pages }, (_, i) => <option key={i} value={i + 1}>{i + 1} / {pg.pages}쪽</option>)}
          </Select>
          <Button size="icon-sm" variant="ghost" aria-label="다음 쪽" disabled={pg.p >= pg.pages} onClick={() => onPage(pg.p + 1)}><ChevronRight /></Button>
        </div>
      )}
      <Select aria-label="한 쪽에 표시할 개수" className="h-8 w-24 text-[13px]" value={size} onChange={(e) => onSize(Number(e.target.value))}>
        {(SCALE.pageSizes as number[]).map((n) => <option key={n} value={n}>{n ? n + "개씩" : "전체"}</option>)}
      </Select>
    </div>
  );
}
