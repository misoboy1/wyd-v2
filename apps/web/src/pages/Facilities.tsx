import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Building2, ChevronDown, ChevronUp, Download, FileDown, Pencil, Plus, Printer, Zap } from "lucide-react";
import { isSleepRoom, PARISH, SPECIAL, type Facility, type Visitor } from "@wyd/shared";
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
import { cn, num } from "@/lib/utils";
import { useStayIndex } from "@/components/stay/useStayIndex";
import { GuestList } from "@/components/stay/GuestList";
import { VisitorEditDialog } from "@/components/stay/VisitorEditDialog";
import { AutoAssignDialog } from "@/components/stay/AutoAssignDialog";
import { TeamRoster } from "@/components/stay/TeamRoster";
import { Dash, FacStatus, SortHead, type SortState } from "@/components/stay/bits";
import { applyCols, facilityCols, roomLabel, sortFacilities, type FacSortKey } from "@/components/stay/stay";

export default function Facilities() {
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
  const cols = useMemo(() => facilityCols(I), [I]);

  const columns = useMemo<Column<Facility>[]>(() => {
    const H = (k: FacSortKey, l: string, sub?: string) => <SortHead k={k} label={l} sort={sort} onSort={setSort} sub={sub} />;
    const c: Column<Facility>[] = [
      { key: "rno", header: H("rno", "번호"), cell: (f) => <span className="font-semibold text-ink-3">{f.rno || "—"}</span> },
      {
        key: "name",
        header: H("name", "공간"),
        cell: (f) => (
          <div className="whitespace-nowrap">
            <div className="font-semibold">{f.name}</div>
            {f.area && <div className="text-[11.5px] text-ink-3">{f.area}</div>}
          </div>
        ),
      },
      { key: "type", header: H("type", "유형"), cell: (f) => <span className="whitespace-nowrap">{f.type || "—"}</span> },
      { key: "status", header: H("status", "상태"), cell: (f) => <FacStatus s={f.status} /> },
      {
        key: "occ",
        header: H("occ", "숙박 방문자", `총 수용 ${num(sums.cap)}명 · 배정 ${num(sums.in)}명`),
        cell: (f) => <OccCell f={f} people={I.byFacility.get(f.id) || []} open={open.has(f.id)} onToggle={() => toggle(f.id)} />,
      },
      {
        key: "gender",
        header: H("gender", "남녀"),
        cell: (f) =>
          f.gender ? <Badge tone={f.gender === "남" ? "blue" : f.gender === "여" ? "amber" : "gray"}>{f.gender}</Badge> : <Dash />,
      },
      { key: "ac", header: H("ac", "냉방"), cell: (f) => f.ac || "—" },
      {
        key: "note",
        header: H("note", "비고"),
        className: "min-w-48 text-ink-3",
        cell: (f) => <span className="whitespace-pre-wrap">{f.note || "—"}</span>,
      },
    ];
    if (editable)
      c.push({
        key: "edit",
        header: <span className="sr-only">관리</span>,
        cell: (f) => (
          <Button size="sm" variant="ghost" onClick={() => setEdit({ row: f })}>
            <Pencil />
            편집
          </Button>
        ),
      });
    return c;
  }, [sort, sums, I, open, editable]);

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
        title="성당시설"
        subtitle={`교리실 14개+대성전 · 마당 ${PARISH.yardArea} · 숙박 방문자 = 배정/수용 · 열 제목을 눌러 정렬 · 번호(R01~)는 동선에 맞게 추후 변경될 수 있음 · 만남의 방·대성전은 항상 맨 아래 고정`}
        actions={
          <>
            <Menu
              trigger={
                <Button>
                  <FileDown />
                  내보내기
                </Button>
              }
            >
              <MenuItem
                icon={<Download />}
                onSelect={() =>
                  downloadCSV(
                    `${PARISH.name}_성당시설`,
                    cols.map((x) => x[0]),
                    applyCols(cols, sortFacilities(facilities, I)),
                  )
                }
              >
                CSV 내려받기
              </MenuItem>
              <MenuItem
                icon={<Printer />}
                onSelect={() =>
                  printDocument(
                    `${PARISH.name} 성당시설 (교리실·수용 현황)`,
                    [{ columns: cols.map((x) => x[0]), rows: applyCols(cols, sortFacilities(facilities, I)) }],
                    {
                      kpis: [
                        ["숙박 수용(점검중 제외)", num(sums.cap) + "명"],
                        ["배정", num(sums.in) + "명"],
                      ],
                    },
                  )
                }
              >
                인쇄 / PDF
              </MenuItem>
            </Menu>
            {isAdmin && (
              <Button variant="soft" onClick={() => setAaOpen(true)}>
                <Zap />
                자동 배정
              </Button>
            )}
            {editable && (
              <Button variant="primary" onClick={() => setEdit({ row: null })}>
                <Plus />
                추가
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TeamRoster
          icon="🛠"
          title="시설팀 명단"
          desc="화장실·샤워·숙박·음향·전력 등 시설 관리 (2~4명)"
          teamName="시설팀"
          keywords={["시설팀", "시설위원회"]}
        />
        <TeamRoster
          icon="🎯"
          title="운영팀 명단"
          desc="본대회 봉사자 관리·이동수단·안전·물품 배분 (3~4명)"
          teamName="운영팀"
          keywords={["운영팀"]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="숙박 교리실 수면 수용(추정)" value={`${num(sums.avail)}명`} />
        <Stat
          label="숙박 배정 / 수용"
          value={`${num(sums.in)} / ${num(sums.cap)}`}
          tone={sums.cap && sums.in > sums.cap ? "bad" : "primary"}
          hint="점검중 제외"
        />
        <Stat label="대성전 교리교육" value="400석" />
        <Stat label="화장실" value="남2·여2" tone="bad" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="mr-auto text-[12.5px] text-ink-3">
            '숙박 방문자'의 명단 버튼을 누르면 그 교리실 밑에 방문자 명단(연동)이 펼쳐집니다.
          </span>
          {roomIds.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(allOpen ? new Set() : new Set(roomIds))}>
              {allOpen ? (
                <>
                  <ChevronUp />
                  모두 접기
                </>
              ) : (
                <>
                  <ChevronDown />
                  모두 펼치기
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
              emptyMsg="이 교리실에 배정된 방문자가 없습니다."
              onGo={() => navigate(`/visitors?room=${f.id}`)}
              onEdit={setVisEdit}
            />
          )}
          empty={
            <Empty icon={<Building2 />} title="표시할 시설이 없습니다.">
              {editable ? "＋ 추가로 교리실·공간을 등록하세요." : null}
            </Empty>
          }
        />
      </Card>

      <Card className="border-warn/30 bg-warn-soft/40 p-4">
        <div className="mb-1.5 text-[14px] font-semibold text-ink">특이·제안사항 (체크리스트 기재)</div>
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
          title={edit?.row ? `편집 · 시설 ${roomLabel(edit.row)}` : "추가 · 시설"}
          deleteLabel="삭제하면 되돌릴 수 없습니다. 이 시설에 배정되어 있던 방문자는 '미배정'이 됩니다."
        />
      )}
      <VisitorEditDialog open={!!visEdit} onOpenChange={(o) => !o && setVisEdit(null)} row={visEdit} />
      {isAdmin && <AutoAssignDialog open={aaOpen} onOpenChange={setAaOpen} />}
    </div>
  );
}

/** 숙박 방문자 = 배정/수용 + 명단 펼치기 (만실·초과·수용 미입력·성별 불일치 표시) */
function OccCell({ f, people, open, onToggle }: { f: Facility; people: Visitor[]; open: boolean; onToggle: () => void }) {
  const cap = Number(f.cap) || 0;
  if (!isSleepRoom(f))
    return <span className="text-[12.5px] whitespace-nowrap text-ink-3">{cap ? num(cap) + "석 · " : ""}숙박 외 용도</span>;
  const n = people.length,
    over = cap > 0 && n > cap,
    full = cap > 0 && n === cap;
  const g = f.gender || "공용";
  const bad = g === "공용" ? 0 : people.filter((v) => v.sex && v.sex !== g).length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn("text-[15px] font-bold tabular", over ? "text-bad" : full ? "text-good" : "text-ink")}>
        {n}
        <span className="text-[12px] font-medium text-ink-3">/{cap || "—"}명</span>
      </span>
      <Button size="sm" variant={open ? "soft" : "secondary"} className="h-7" onClick={onToggle} aria-expanded={open}>
        {open ? (
          <>
            <ChevronUp />
            접기
          </>
        ) : n ? (
          <>
            <ChevronDown />
            {n}명 보기
          </>
        ) : (
          "배정 없음"
        )}
      </Button>
      {over ? <Badge tone="red">초과</Badge> : full ? <Badge tone="green">만실</Badge> : null}
      {!cap && <span className="text-[11px] text-bad">수용 미입력</span>}
      {bad > 0 && (
        <Badge tone="red" title={`${g} 전용 방에 다른 성별 ${bad}명 — 방문자 편집에서 숙소를 바꾸세요`}>
          성별 불일치 {bad}
        </Badge>
      )}
    </div>
  );
}
