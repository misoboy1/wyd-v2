import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Building2, ChevronDown, ChevronUp, Download, FileDown, Pencil, Plus, Printer, Zap } from "lucide-react";
import { isSleepRoom, PARISH, SPECIAL, type Facility, type MsgKey, type Visitor } from "@wyd/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Empty, PageHeader, Skeleton, Stat } from "@/components/ui/misc";
import { DataTable, type Column } from "@/components/ui/table";
import { EditDialog } from "@/components/form/EditDialog";
import { useCan } from "@/lib/auth";
import { downloadCSV } from "@/lib/csv";
import { printDocument } from "@/lib/print";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useStayIndex } from "@/components/stay/useStayIndex";
import { GuestList } from "@/components/stay/GuestList";
import { VisitorEditDialog } from "@/components/stay/VisitorEditDialog";
import { AutoAssignDialog } from "@/components/stay/AutoAssignDialog";
import { TeamRoster } from "@/components/stay/TeamRoster";
import { Dash, FacStatus, SortHead, type SortState } from "@/components/stay/bits";
import { applyCols, facilityCols, roomLabel, sortFacilities, type FacSortKey } from "@/components/stay/stay";

export default function Facilities() {
  const tr = useT();
  const { t, label, num } = tr;
  const { I, facilities, isLoading } = useStayIndex();
  const { isAdmin, canWrite } = useCan();
  const editable = canWrite("facilities");
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortState<FacSortKey>>({ key: "rno", dir: 1 });
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [edit, setEdit] = useState<{ row: Facility | null } | null>(null);
  const [visEdit, setVisEdit] = useState<Visitor | null>(null);
  const [aaOpen, setAaOpen] = useState(false);

  const rows = useMemo(() => sortFacilities(facilities, I, sort.key, sort.dir), [facilities, I, sort]);
  const sums = useMemo(() => {
    // 숙박 교리실 합계(점검중 제외) — '숙박 방문자' 열 제목에 총 수용 가능 인원 표시
    const sleep = facilities.filter((f) => isSleepRoom(f) && f.status !== "점검중");
    return {
      cap: sleep.reduce((s, f) => s + (Number(f.cap) || 0), 0),
      in: sleep.reduce((s, f) => s + (I.byFacility.get(f.id)?.length || 0), 0),
      avail: facilities
        .filter((f) => String(f.type || "").includes("교리실"))
        .reduce((s, f) => s + (f.status !== "점검중" ? Number(f.cap) || 0 : 0), 0),
    };
  }, [facilities, I]);
  const roomIds = rows.filter(isSleepRoom).map((f) => f.id);
  const allOpen = roomIds.length > 0 && roomIds.every((id) => open.has(id));
  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const cols = useMemo(() => facilityCols(I, tr), [I, tr]);

  const columns = useMemo<Column<Facility>[]>(() => {
    const H = (k: FacSortKey, l: MsgKey, sub?: string) => <SortHead k={k} label={t(l)} sort={sort} onSort={setSort} sub={sub} />;
    const c: Column<Facility>[] = [
      { key: "rno", header: H("rno", "stay.col.pid"), cell: (f) => <span className="font-semibold text-ink-3">{f.rno || "—"}</span> },
      {
        key: "name",
        header: H("name", "stay.col.space"),
        cell: (f) => (
          <div className="whitespace-nowrap">
            <div className="font-semibold">{f.name}</div>
            {f.area && <div className="text-[11.5px] text-ink-3">{f.area}</div>}
          </div>
        ),
      },
      { key: "type", header: H("type", "stay.col.type"), cell: (f) => <span className="whitespace-nowrap">{f.type || "—"}</span> },
      { key: "status", header: H("status", "stay.col.status"), cell: (f) => <FacStatus s={f.status} /> },
      {
        key: "occ",
        header: H("occ", "stay.fac.occHead", t("stay.fac.occSub", { cap: sums.cap, n: sums.in })),
        cell: (f) => <OccCell f={f} people={I.byFacility.get(f.id) || []} open={open.has(f.id)} onToggle={() => toggle(f.id)} />,
      },
      {
        key: "gender",
        header: H("gender", "stay.col.gender"),
        cell: (f) =>
          f.gender ? (
            <Badge tone={f.gender === "남" ? "blue" : f.gender === "여" ? "amber" : "gray"}>{label("sex", f.gender)}</Badge>
          ) : (
            <Dash />
          ),
      },
      { key: "ac", header: H("ac", "stay.col.ac"), cell: (f) => f.ac || "—" },
      {
        key: "note",
        header: H("note", "stay.col.note"),
        className: "min-w-48 text-ink-3",
        cell: (f) => <span className="whitespace-pre-wrap">{f.note || "—"}</span>,
      },
    ];
    if (editable)
      c.push({
        key: "edit",
        header: <span className="sr-only">{t("stay.ui.manage")}</span>,
        cell: (f) => (
          <Button size="sm" variant="ghost" onClick={() => setEdit({ row: f })}>
            <Pencil />
            {t("stay.ui.edit")}
          </Button>
        ),
      });
    return c;
  }, [sort, sums, I, open, editable, t, label]);

  if (isLoading)
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-28" />
        <Skeleton className="h-96" />
      </div>
    );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Building2 />}
        title={t("stay.fac.title")}
        subtitle={t("stay.fac.subtitle", { yard: PARISH.yardArea })}
        actions={
          <>
            <Menu
              trigger={
                <Button>
                  <FileDown />
                  {t("stay.ui.export")}
                </Button>
              }
            >
              <MenuItem
                icon={<Download />}
                onSelect={() =>
                  downloadCSV(
                    `${PARISH.name}_${t("stay.fac.file")}`,
                    cols.map((x) => x[0]),
                    applyCols(cols, sortFacilities(facilities, I)),
                  )
                }
              >
                {t("stay.ui.csvDownload")}
              </MenuItem>
              <MenuItem
                icon={<Printer />}
                onSelect={() =>
                  printDocument(
                    t("stay.fac.printTitle", { parish: PARISH.name }),
                    [{ columns: cols.map((x) => x[0]), rows: applyCols(cols, sortFacilities(facilities, I)) }],
                    {
                      kpis: [
                        [t("stay.fac.kpiCap"), t("common.people", { n: sums.cap })],
                        [t("stay.fac.kpiAssigned"), t("common.people", { n: sums.in })],
                      ],
                    },
                  )
                }
              >
                {t("stay.fac.print")}
              </MenuItem>
            </Menu>
            {isAdmin && (
              <Button variant="soft" onClick={() => setAaOpen(true)}>
                <Zap />
                {t("stay.ui.autoAssign")}
              </Button>
            )}
            {editable && (
              <Button variant="primary" onClick={() => setEdit({ row: null })}>
                <Plus />
                {t("common.add")}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TeamRoster
          icon="🛠"
          title={t("stay.fac.teamFacTitle")}
          desc={t("stay.fac.teamFacDesc")}
          teamName="시설팀"
          keywords={["시설팀", "시설위원회"]}
        />
        <TeamRoster icon="🎯" title={t("stay.fac.teamOpsTitle")} desc={t("stay.fac.teamOpsDesc")} teamName="운영팀" keywords={["운영팀"]} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("stay.fac.statSleep")} value={t("common.people", { n: sums.avail })} />
        <Stat
          label={t("stay.fac.statOcc")}
          value={`${num(sums.in)} / ${num(sums.cap)}`}
          tone={sums.cap && sums.in > sums.cap ? "bad" : "primary"}
          hint={t("stay.fac.statOccHint")}
        />
        <Stat label={t("stay.fac.statHall")} value={t("stay.fac.statHallValue")} />
        <Stat label={t("stay.fac.statToilet")} value={t("stay.fac.statToiletValue")} tone="bad" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="mr-auto text-[12.5px] text-ink-3">{t("stay.fac.expandHint")}</span>
          {roomIds.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(allOpen ? new Set() : new Set(roomIds))}>
              {allOpen ? (
                <>
                  <ChevronUp />
                  {t("stay.fac.collapseAll")}
                </>
              ) : (
                <>
                  <ChevronDown />
                  {t("stay.fac.expandAll")}
                </>
              )}
            </Button>
          )}
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(f) => f.id}
          isExpanded={(f) => open.has(f.id)}
          rowClassName={(f) => (open.has(f.id) ? "[&>td]:bg-primary-soft/40" : undefined)}
          renderExpanded={(f) => (
            <GuestList
              title={roomLabel(f)}
              list={I.byFacility.get(f.id) || []}
              cap={f.cap}
              emptyMsg={t("stay.ui.roomEmpty")}
              onGo={() => navigate(`/visitors?room=${f.id}`)}
              onEdit={setVisEdit}
            />
          )}
          empty={
            <Empty icon={<Building2 />} title={t("stay.fac.empty")}>
              {editable ? t("stay.fac.emptyHint") : null}
            </Empty>
          }
        />
      </Card>

      <Card className="border-warn/30 bg-warn-soft/40 p-4">
        <div className="mb-1.5 text-[14px] font-semibold text-ink">{t("stay.fac.special")}</div>
        <ul className="list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed text-ink-2">
          {SPECIAL.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Card>

      {editable && (
        <EditDialog
          table="facilities"
          open={!!edit}
          onOpenChange={(o) => !o && setEdit(null)}
          row={edit?.row ?? null}
          title={edit?.row ? t("stay.fac.editTitle", { label: roomLabel(edit.row) }) : t("stay.fac.addTitle")}
          deleteLabel={t("stay.fac.deleteLabel")}
        />
      )}
      <VisitorEditDialog open={!!visEdit} onOpenChange={(o) => !o && setVisEdit(null)} row={visEdit} />
      {isAdmin && <AutoAssignDialog open={aaOpen} onOpenChange={setAaOpen} />}
    </div>
  );
}

/** 숙박 방문자 = 배정/수용 + 명단 펼치기 (만실·초과·수용 미입력·성별 불일치 표시) */
function OccCell({ f, people, open, onToggle }: { f: Facility; people: Visitor[]; open: boolean; onToggle: () => void }) {
  const { t, label } = useT();
  const cap = Number(f.cap) || 0;
  if (!isSleepRoom(f))
    return (
      <span className="text-[12.5px] whitespace-nowrap text-ink-3">
        {cap ? t("stay.fac.seatsNonSleep", { n: cap }) : t("stay.fac.nonSleep")}
      </span>
    );
  const n = people.length,
    over = cap > 0 && n > cap,
    full = cap > 0 && n === cap;
  const g = f.gender || "공용";
  const bad = g === "공용" ? 0 : people.filter((v) => v.sex && v.sex !== g).length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn("text-[15px] font-bold tabular", over ? "text-bad" : full ? "text-good" : "text-ink")}>
        {n}
        <span className="text-[12px] font-medium text-ink-3">{t("stay.fac.capOf", { cap: cap || "—" })}</span>
      </span>
      <Button size="sm" variant={open ? "soft" : "secondary"} className="h-7" onClick={onToggle} aria-expanded={open}>
        {open ? (
          <>
            <ChevronUp />
            {t("stay.ui.collapse")}
          </>
        ) : n ? (
          <>
            <ChevronDown />
            {t("stay.ui.showN", { n })}
          </>
        ) : (
          t("stay.ui.noGuests")
        )}
      </Button>
      {over ? <Badge tone="red">{t("stay.ui.over")}</Badge> : full ? <Badge tone="green">{t("stay.ui.full")}</Badge> : null}
      {!cap && <span className="text-[11px] text-bad">{t("stay.fac.noCap")}</span>}
      {bad > 0 && (
        <Badge tone="red" title={t("stay.fac.sexMismatchTitle", { sex: label("sex", g), n: bad })}>
          {t("stay.fac.sexMismatch", { n: bad })}
        </Badge>
      )}
    </div>
  );
}
