import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn, cmp } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, i: number) => ReactNode;
  /** 정렬 값(주면 머리글 클릭 정렬) */
  sortValue?: (row: T) => unknown;
  className?: string;
  headClassName?: string;
  /** 좁은 화면에서 숨김 */
  hideOnMobile?: boolean;
}

/**
 * 공용 표 — 정렬, 행 펼치기, 많은 행(150+)은 창 스크롤 가상화(방문자 1,000명도 부드럽게).
 * 좁은 화면에서는 가로 스크롤 + 첫 열 고정.
 */
export function DataTable<T>({ rows, columns, rowKey, isExpanded, renderExpanded, onRowClick, empty, initialSort, rowClassName, className, dense }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string | number;
  /** 행 아래 펼침 영역(숙박자 명단 등) */
  isExpanded?: (r: T) => boolean; renderExpanded?: (r: T) => ReactNode; onRowClick?: (r: T) => void; empty?: ReactNode;
  initialSort?: { key: string; dir: 1 | -1 }; rowClassName?: (r: T) => string | undefined; className?: string; dense?: boolean;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return rows.slice().sort((a, b) => {
      const x = sv(a), y = sv(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : cmp(x, y)) * sort.dir;
    });
  }, [rows, sort, columns]);

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  // 펼친 행이 있으면 가상화 끔(높이 가변)
  const virtual = sorted.length > 150 && !(isExpanded && sorted.some(isExpanded));
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => { if (virtual && tbodyRef.current) setMargin(tbodyRef.current.getBoundingClientRect().top + window.scrollY); }, [virtual, sorted.length]);
  const v = useWindowVirtualizer({ count: sorted.length, estimateSize: () => (dense ? 40 : 48), overscan: 12, scrollMargin: margin, enabled: virtual });
  const items = virtual ? v.getVirtualItems() : null;
  const padTop = items && items.length ? items[0].start - v.options.scrollMargin : 0;
  const padBottom = items && items.length ? v.getTotalSize() - (items[items.length - 1].end - v.options.scrollMargin) : 0;
  const list = items ? items.map((it) => ({ r: sorted[it.index], i: it.index })) : sorted.map((r, i) => ({ r, i }));

  const toggle = (c: Column<T>) => {
    if (!c.sortValue) return;
    setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }));
  };
  const pad = dense ? "px-3 py-2" : "px-3.5 py-2.5";

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-separate border-spacing-0 text-[13.5px]">
        <thead>
          <tr>
            {columns.map((c, ci) => (
              <th key={c.key} scope="col" onClick={() => toggle(c)}
                className={cn("sticky top-0 z-[1] border-b border-line bg-surface-2/95 text-left text-[12.5px] font-semibold whitespace-nowrap text-ink-3 backdrop-blur", pad,
                  c.sortValue && "cursor-pointer select-none hover:text-ink", ci === 0 && "sticky left-0 z-[2]", c.hideOnMobile && "max-md:hidden", c.headClassName)}>
                <span className="inline-flex items-center gap-1">
                  {c.header}
                  {c.sortValue && (sort?.key === c.key ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {padTop > 0 && <tr aria-hidden style={{ height: padTop }} />}
          {list.map(({ r, i }) => {
            const ex = isExpanded?.(r) && renderExpanded ? renderExpanded(r) : null;
            return (
              <Fragment key={rowKey(r)}>
                <tr data-index={i} ref={virtual ? v.measureElement : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={cn("group", onRowClick && "cursor-pointer", rowClassName?.(r))}>
                  {columns.map((c, ci) => (
                    <td key={c.key} className={cn("border-b border-line align-middle text-ink transition-colors group-hover:bg-surface-2/60", pad,
                      ci === 0 && "sticky left-0 bg-surface", c.hideOnMobile && "max-md:hidden", c.className)}>
                      {c.cell(r, i)}
                    </td>
                  ))}
                </tr>
                {ex && (
                  <tr>
                    <td colSpan={columns.length} className="border-b border-line bg-surface-2/50 p-0">{ex}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {padBottom > 0 && <tr aria-hidden style={{ height: padBottom }} />}
        </tbody>
      </table>
      {!sorted.length && (empty ?? <div className="py-12 text-center text-[13.5px] text-ink-3">표시할 항목이 없습니다.</div>)}
    </div>
  );
}
