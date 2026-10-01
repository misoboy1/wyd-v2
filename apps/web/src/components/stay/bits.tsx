// 숙소 화면 공용 작은 조각 — 연락처, 상태 배지, 가족 구성 칩, 정렬 머리글, 쪽 나누기
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { reqSex, SCALE, type Homestay } from "@wyd/shared";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn, isBrokenTel, telHref } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { famItems, famLabel, type CountUnit } from "./stay";

/** 연락처 — 시트 수식 오류(#ERROR! 등)는 재입력 경고 */
export function Tel({ tel }: { tel?: string }) {
  const { t } = useT();
  const v = String(tel ?? "");
  if (!v) return <span className="text-ink-3">—</span>;
  if (v.includes("••••")) return <span className="text-ink-3">{v}</span>;
  if (isBrokenTel(v) || /^#(REF|N\/A)/i.test(v))
    return (
      <span className="text-[12px] whitespace-nowrap text-bad" title={t("stay.tel.brokenTitle")}>
        {t("stay.tel.broken")}
      </span>
    );
  return (
    <a href={telHref(v)} className="whitespace-nowrap text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
      {v}
    </a>
  );
}

export const Dash = () => <span className="text-ink-3">—</span>;
export function VisStatus({ s }: { s: string }) {
  const { label } = useT();
  return <Badge tone={s === "변동중" ? "amber" : s === "대기" ? "gray" : "green"}>{s ? label("visitorStatus", s) : "—"}</Badge>;
}
export function FacStatus({ s }: { s: string }) {
  const { label } = useT();
  return s ? <Badge tone={s === "가용" ? "green" : s === "사용중" ? "blue" : "amber"}>{label("facilityStatus", s)}</Badge> : <Dash />;
}
export function HsStatus({ s }: { s: string }) {
  const { label } = useT();
  return s ? (
    <Badge tone={s === "입실" ? "green" : s === "확정" ? "blue" : s === "퇴실" ? "gray" : "amber"}>{label("homestayStatus", s)}</Badge>
  ) : (
    <Dash />
  );
}
export function SexTag({ sex }: { sex: string }) {
  const { label } = useT();
  return sex ? <Badge tone={sex === "남" ? "blue" : sex === "여" ? "amber" : "gray"}>{label("sex", sex)}</Badge> : <Dash />;
}
export function ReqSexBadge({ h }: { h: Homestay }) {
  const { label } = useT();
  const rs = reqSex(h);
  return rs === "—" ? <Dash /> : <Badge tone={rs === "남" ? "blue" : rs === "여" ? "amber" : "gray"}>{label("sex", rs)}</Badge>;
}

/** 가족 인원 칩(성인=회색, 남=파랑, 여=주황) — 기존 famBadges */
const FAM_TONE: Record<string, Tone> = { mAdult: "gray", fAdult: "gray", mStu: "blue", fStu: "amber", mYng: "blue", fYng: "amber" };
export function FamBadges({ h }: { h: Homestay }) {
  const tr = useT();
  const { t } = tr;
  const items = famItems(h);
  if (!items.length) {
    const text = famLabel(h, false, tr);
    return text === "—" ? <Dash /> : <span className="text-[12.5px]">{text}</span>;
  }
  const total = items.reduce((s, x) => s + x[1], 0);
  return (
    <div className="flex min-w-36 flex-wrap items-center gap-1">
      {items.map(([k, n]) => (
        <Badge key={k} tone={FAM_TONE[k]} className="text-[11px]">
          {t("stay.fam.item", { label: t(`stay.fam.${k}`), n })}
        </Badge>
      ))}
      <span className="text-[11.5px] font-semibold text-ink-3">{t("stay.fam.badgeTotal", { n: total })}</span>
    </div>
  );
}

/** 정렬 머리글 버튼(쪽 나누기와 함께 쓰려고 표 밖에서 정렬) */
export interface SortState<K extends string> {
  key: K;
  dir: 1 | -1;
}
export function SortHead<K extends string>({
  k,
  label,
  sort,
  onSort,
  sub,
}: {
  k: K;
  label: ReactNode;
  sort: SortState<K>;
  onSort: (s: SortState<K>) => void;
  sub?: ReactNode;
}) {
  const { t } = useT();
  const on = sort.key === k;
  return (
    <button
      type="button"
      onClick={() => onSort({ key: k, dir: on ? (-sort.dir as 1 | -1) : 1 })}
      className={cn("inline-flex flex-col items-start text-left hover:text-ink", on && "text-ink")}
      aria-label={t("stay.ui.sortBy", { label: typeof label === "string" ? label : "" })}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {on ? (
          sort.dir === 1 ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </span>
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
export function Pager({
  total,
  unit,
  page,
  size,
  onPage,
  onSize,
}: {
  total: number;
  unit: CountUnit;
  page: number;
  size: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}) {
  const { t, num } = useT();
  const pg = usePage(total, page, size);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
      <span className="tabular">
        {total ? `${num(pg.start + 1)}–${num(pg.end)} / ` : ""}
        {t(`stay.unit.${unit}`, { n: total })}
      </span>
      <span className="flex-1" />
      {pg.pages > 1 && (
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label={t("stay.pager.prev")} disabled={pg.p <= 1} onClick={() => onPage(pg.p - 1)}>
            <ChevronLeft />
          </Button>
          <Select
            aria-label={t("stay.pager.select")}
            className="h-8 w-28 text-[13px]"
            value={pg.p}
            onChange={(e) => onPage(Number(e.target.value))}
          >
            {Array.from({ length: pg.pages }, (_, i) => (
              <option key={i} value={i + 1}>
                {t("stay.pager.pageOf", { p: i + 1, pages: pg.pages })}
              </option>
            ))}
          </Select>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("stay.pager.next")}
            disabled={pg.p >= pg.pages}
            onClick={() => onPage(pg.p + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
      <Select
        aria-label={t("stay.pager.size")}
        className="h-8 w-24 text-[13px]"
        value={size}
        onChange={(e) => onSize(Number(e.target.value))}
      >
        {SCALE.pageSizes.map((n) => (
          <option key={n} value={n}>
            {n ? t("stay.pager.perPage", { n }) : t("common.all")}
          </option>
        ))}
      </Select>
    </div>
  );
}
