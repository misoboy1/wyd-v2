// 조직도 '참고' 섹션 — 분과·구역 표, 단체별 배정 목표, 업무 분야별 인원
import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Star } from "lucide-react";
import type { Department } from "@wyd/shared";
import { TASKCATS, VOL_ORG_TARGET } from "@wyd/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditDialog } from "@/components/form/EditDialog";
import { bulkSave, toastBulk } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { Vol } from "./vol";

/** 접히는 참고 섹션 */
export function Collapsible({
  title,
  sub,
  children,
  defaultOpen = false,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ChevronDown className={cn("size-4.5 shrink-0 text-ink-3 transition-transform", !open && "-rotate-90")} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Badge tone="outline">참고</Badge>
              {title}
            </span>
            {sub && <span className="mt-0.5 block text-[12.5px] text-ink-3">{sub}</span>}
          </span>
        </button>
        {open && actions}
      </div>
      {open && <div className="border-t border-line">{children}</div>}
    </Card>
  );
}

const th = "border-b border-line bg-surface-2 px-3 py-2 text-left text-[12.5px] font-semibold whitespace-nowrap text-ink-3";
const td = "border-b border-line px-3 py-2.5 align-top";

/** 분과·구역 표(관리자 편집·순서 이동) */
export function DeptSection({ depts, vols, admin }: { depts: Department[]; vols: Vol[]; admin: boolean }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ row?: Department | null } | null>(null);
  const [moving, setMoving] = useState(false);
  const count = useMemo(() => {
    const m = new Map<number, number>();
    vols.forEach((v) => v.deptId != null && m.set(v.deptId, (m.get(v.deptId) ?? 0) + 1));
    return m;
  }, [vols]);
  const nextSort = depts.reduce((m, d) => Math.max(m, d.sort ?? 0), 0) + 1;
  const defaults = useMemo(() => ({ name: "", kind: "분과", task: "", key: false, sort: nextSort }), [nextSort]);
  // 같은 구분 안에서 인접 항목과 순서 교환(두 행을 한 번에 저장)
  const move = async (d: Department, dir: -1 | 1) => {
    const arr = depts.filter((x) => (x.kind || "분과") === (d.kind || "분과"));
    const i = arr.findIndex((x) => x.id === d.id),
      j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const b = arr[j];
    const sa = d.sort ?? 0;
    let sb = b.sort ?? 0;
    if (sa === sb) sb = sa + dir; // 순서 값이 같으면 강제로 벌림
    setMoving(true);
    const res = await bulkSave(qc, "departments", [
      { id: d.id, version: d.version, sort: sb },
      { id: b.id, version: b.version, sort: sa },
    ]);
    setMoving(false);
    if (res.some((r) => !r.ok)) toastBulk("순서 변경", res);
  };
  return (
    <Collapsible
      title="분과·구역"
      sub={`본당 분과 ${depts.filter((d) => d.kind !== "구역").length}개 · 구역 ${depts.filter((d) => d.kind === "구역").length}개 · 봉사자의 소속 분과·구역은 참고 정보입니다`}
      actions={
        admin && (
          <Button size="sm" onClick={() => setEdit({})}>
            <Plus />
            분과·구역(참고)
          </Button>
        )
      }
    >
      {depts.length ? (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-[13.5px]">
            <thead>
              <tr>
                <th className={th}>구분</th>
                <th className={th}>이름</th>
                <th className={th}>임무</th>
                <th className={th}>봉사자(참고)</th>
                {admin && <th className={th}>관리</th>}
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => (
                <tr
                  key={d.id}
                  className={cn(admin && "cursor-pointer hover:bg-surface-2/60")}
                  onClick={admin ? () => setEdit({ row: d }) : undefined}
                >
                  <td className={td}>
                    <Badge tone={d.kind === "구역" ? "gold" : "blue"}>{d.kind || "분과"}</Badge>
                  </td>
                  <td className={cn(td, "font-semibold whitespace-nowrap")}>
                    {d.key && <Star className="mr-1 inline size-3.5 fill-current text-gold" aria-label="핵심" />}
                    {d.name}
                  </td>
                  <td className={cn(td, "min-w-56 whitespace-pre-wrap text-ink-2")}>{d.task || <span className="text-ink-3">—</span>}</td>
                  <td className={cn(td, "tabular")}>{count.get(d.id) ?? 0}명</td>
                  {admin && (
                    <td className={cn(td, "whitespace-nowrap")} onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`${d.name} 위로`}
                        disabled={moving}
                        onClick={() => void move(d, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`${d.name} 아래로`}
                        disabled={moving}
                        onClick={() => void move(d, 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-8 text-center text-[13.5px] text-ink-3">등록된 분과·구역이 없습니다.</div>
      )}
      <EditDialog
        table="departments"
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        row={edit?.row}
        defaults={defaults}
        title={edit?.row ? "분과·구역 수정" : "분과·구역 추가"}
        description="봉사자 소속 분과·구역(참고)에 쓰입니다."
        deleteLabel="분과·구역을 삭제하면 이 분과로 표시된 봉사자는 '참고 분과 없음'이 됩니다."
      />
    </Collapsible>
  );
}

const norm = (s: string) =>
  String(s || "")
    .replace(/[\s.·]/g, "")
    .toLowerCase();

/** 단체별 봉사자(위원) 배정 목표 + 업무 분야별 인원 */
export function TargetSection({ vols }: { vols: Vol[] }) {
  const total = VOL_ORG_TARGET.reduce((s: number, t: any) => s + t.target, 0);
  // 본당단체 이름이 목표 단체명을 포함하면 같은 단체로 셈(예: 'M.E' → ME)
  const cur = (org: string) => vols.filter((v) => v.org && norm(v.org).includes(norm(org))).length;
  return (
    <Collapsible title="단체별 배정 목표" sub={`운영 계획안 · 1차 합계 ${total}명 내외`}>
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-separate border-spacing-0 text-[13.5px]">
            <thead>
              <tr>
                <th className={th}>단체</th>
                <th className={th}>목표</th>
                <th className={th}>현재(본당단체 기준)</th>
              </tr>
            </thead>
            <tbody>
              {VOL_ORG_TARGET.map((t: any) => {
                const n = cur(t.org);
                return (
                  <tr key={t.org}>
                    <td className={cn(td, "font-medium")}>{t.org}</td>
                    <td className={cn(td, "tabular")}>{t.target}명</td>
                    <td className={td}>
                      <Badge tone={n >= t.target ? "green" : n ? "amber" : "gray"}>{n}명</Badge>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className={cn(td, "font-bold")}>합계</td>
                <td className={cn(td, "font-bold tabular")}>{total}명</td>
                <td className={td} />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-separate border-spacing-0 text-[13.5px]">
            <thead>
              <tr>
                <th className={th}>업무 분야</th>
                <th className={th}>최소</th>
                <th className={th}>예비</th>
                <th className={th}>배정</th>
              </tr>
            </thead>
            <tbody>
              {TASKCATS.map((t: any) => {
                const gap = t.assigned < t.min + t.reserve;
                return (
                  <tr key={t.name}>
                    <td className={cn(td, "font-medium")}>{t.name}</td>
                    <td className={cn(td, "tabular")}>{t.min}</td>
                    <td className={cn(td, "tabular")}>{t.reserve}</td>
                    <td className={td}>
                      <Badge tone={gap ? "red" : "green"}>
                        {t.assigned}
                        {gap ? ` · ${t.min + t.reserve - t.assigned}명 부족` : ""}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Collapsible>
  );
}
