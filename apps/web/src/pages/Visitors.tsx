import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ClipboardPaste, Download, FileDown, Languages, Plus, Printer, Users, X, Zap } from "lucide-react";
import { normSex, PARISH, VIRTUAL, type Facility, type MsgKey, type StayIndex, type Visitor } from "@wyd/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SearchInput } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Menu, MenuItem, MenuSep } from "@/components/ui/menu";
import { Empty, PageHeader, Segmented, Skeleton, Stat } from "@/components/ui/misc";
import { DataTable, type Column } from "@/components/ui/table";
import { PasteImport, type PasteDef } from "@/components/form/PasteImport";
import { useCan } from "@/lib/auth";
import { downloadCSV } from "@/lib/csv";
import { printDocument } from "@/lib/print";
import { cmp, matchQuery, sortBy } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useStayIndex } from "@/components/stay/useStayIndex";
import { VisitorEditDialog } from "@/components/stay/VisitorEditDialog";
import { AutoAssignDialog } from "@/components/stay/AutoAssignDialog";
import { PrintPicker } from "@/components/stay/PrintPicker";
import { TeamRoster } from "@/components/stay/TeamRoster";
import { Dash, Pager, SexTag, SortHead, Tel, usePage, VisStatus, type SortState } from "@/components/stay/bits";
import {
  applyCols,
  groupOrder,
  hsLabel,
  orphanText,
  placeKind,
  roomLabel,
  stayText,
  VIS_GROUP_LABEL,
  VIS_GROUPS,
  visFacility,
  visGroupKey,
  visHomestay,
  visitorCols,
  visZone,
  type PlaceKind,
  type Tr,
  type VisGroupBy,
} from "@/components/stay/stay";

type SortKey = "pid" | "gno" | "name" | "sex" | "country" | "lang" | "room" | "stay" | "role" | "status" | "note";
type KindFilter = "all" | PlaceKind;

const pasteDef = ({ t }: Tr): PasteDef => ({
  label: t("stay.vis.pasteLabel"),
  table: "visitors",
  cols: [
    ["gno", t("stay.vis.pasteGno")],
    ["name", t("stay.col.name")],
    ["sex", t("stay.vis.pasteSex")],
    ["country", t("stay.col.country")],
    ["lang", t("stay.col.lang")],
    ["stay", t("stay.col.period")],
    ["role", t("stay.col.role")],
    ["status", t("stay.col.status")],
    ["tel", t("stay.col.tel")],
    ["note", t("stay.col.note")],
  ],
  // 성별 표기(남자·M·female 등) 정규화, 상태 비면 기본값
  mapRow: (o) => ({ ...o, sex: normSex(o.sex), ...(o.status ? {} : { status: "확정" }) }),
});
const PRINT_GROUPERS: VisGroupBy[] = ["gno", "country", "sex", "lang", "stay", "status", "stayplace"];

export default function Visitors() {
  const tr = useT();
  const { t, num } = tr;
  const { I, visitors, isLoading } = useStayIndex();
  const { isAdmin, canWrite, user } = useCan();
  const editable = canWrite("visitors");
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const kind = (sp.get("kind") ?? "all") as KindFilter;
  const zone = sp.get("zone") ?? "";
  const group = (sp.get("group") ?? "none") as VisGroupBy;
  const roomId = sp.get("room") ? Number(sp.get("room")) : null;
  const hsId = sp.get("hs") ? Number(sp.get("hs")) : null;
  // 필터는 주소에 저장 — 홈스테이 화면에 갔다가 '뒤로' 와도 그대로
  const setParam = useCallback(
    (k: string, v: string) =>
      setSp(
        (p) => {
          const n = new URLSearchParams(p);
          if (v && v !== "all" && v !== "none") n.set(k, v);
          else n.delete(k);
          return n;
        },
        { replace: true },
      ),
    [setSp],
  );

  const [sort, setSort] = useState<SortState<SortKey>>({ key: "pid", dir: 1 });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const [edit, setEdit] = useState<{ row: Visitor | null } | null>(null);
  const [aaOpen, setAaOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [roomView, setRoomView] = useState<Facility | null>(null);
  const dq = useDeferredValue(q);
  useEffect(() => setPage(1), [dq, kind, zone, group, roomId, hsId, size]);

  // 검색 대상 문자열(번호·이름·국가·언어·연락처·숙소명·H번호 등) — 표가 바뀔 때만 다시 계산
  const hay = useMemo(() => {
    const m = new Map<number, string>();
    for (const v of visitors) {
      const f = visFacility(v, I),
        h = visHomestay(v, I);
      m.set(
        v.id,
        [
          v.pid,
          v.gno,
          v.name,
          v.sex,
          v.country,
          v.lang,
          v.tel,
          f?.rno,
          f?.name,
          h?.hid,
          h?.host,
          h?.zone,
          v.orphanStay,
          v.stay,
          v.role,
          v.status,
          v.note,
        ].join(" "),
      );
    }
    return m;
  }, [visitors, I]);

  const zones = useMemo(() => {
    const c = new Map<string, number>();
    visitors.forEach((v) => {
      const z = visZone(v, I);
      if (z) c.set(z, (c.get(z) || 0) + 1);
    });
    return [...c].sort((a, b) => cmp(a[0], b[0]));
  }, [visitors, I]);

  const sorted = useMemo(() => {
    const list = visitors.filter(
      (v) =>
        (kind === "all" || placeKind(v, I) === kind) &&
        (!zone || visZone(v, I) === zone) &&
        (roomId == null || v.facilityId === roomId) &&
        (hsId == null || v.homestayId === hsId) &&
        matchQuery(dq, hay.get(v.id)),
    );
    return sortBy(list, (v) => (sort.key === "room" ? stayText(v, I, tr) : (v as any)[sort.key]), sort.dir);
  }, [visitors, I, kind, zone, roomId, hsId, dq, hay, sort, tr]);

  // 묶어보기: 필터 결과 전체 기준으로 묶음 순서·인원을 구하고, 현재 쪽만 소제목과 함께 표시
  const keyOf = useCallback((v: Visitor, by: string) => visGroupKey(v, by as VisGroupBy, I, tr), [I, tr]);
  const grouped = useMemo(() => {
    if (group === "none") return null;
    const keys = new Map(sorted.map((v) => [v, keyOf(v, group)]));
    const { order, count } = groupOrder(sorted, (v) => keys.get(v)!);
    const rank = new Map(order.map((k, i) => [k, i]));
    const ordered = sorted.slice().sort((a, b) => rank.get(keys.get(a)!)! - rank.get(keys.get(b)!)!);
    return { ordered, count };
  }, [sorted, group, keyOf]);
  const list = grouped?.ordered ?? sorted;
  const pg = usePage(list.length, page, size);
  const pageRows = list.slice(pg.start, pg.end);

  const stats = useMemo(() => {
    const lang = new Map<string, number>();
    visitors.forEach((x) => lang.set(x.lang || "", (lang.get(x.lang || "") || 0) + 1));
    return { langs: [...lang].sort((a, b) => b[1] - a[1]), countries: new Set(visitors.map((x) => x.country).filter(Boolean)).size };
  }, [visitors]);
  const allSortedByPid = useMemo(() => sortBy(visitors.slice(), (v) => v.pid), [visitors]);
  const cols = useMemo(() => visitorCols(I, tr), [I, tr]);
  // 선택 인쇄 창이 열렸을 때만 정렬
  const printRowsAll = useMemo(() => (printOpen ? sortedAll(visitors, sort, I, tr) : []), [printOpen, visitors, sort, I, tr]);
  const paste = useMemo(() => pasteDef(tr), [tr]);
  const groupLabel = group !== "none" ? t(VIS_GROUP_LABEL[group]) : "";

  // 콜백을 고정해야 열 정의(useMemo)가 매 렌더마다 다시 만들어지지 않음
  const onEdit = useCallback((row: Visitor) => setEdit({ row }), []);
  const onHs = useCallback((id: number) => void navigate(`/homestays?focus=${id}&from=visitors`), [navigate]);
  const columns = useVisitorColumns({
    I,
    sort,
    setSort,
    editable,
    onEdit,
    onRoom: setRoomView,
    onHs,
  });

  const exportCsv = (rows: Visitor[], suffix = "") =>
    downloadCSV(
      `${PARISH.name}_${t("stay.vis.file")}${suffix}`,
      cols.map((c) => c[0]),
      applyCols(cols, rows),
    );
  const printRows = (title: string, rows: Visitor[], subtitle?: string) =>
    printDocument(title, [{ columns: cols.map((c) => c[0]), rows: applyCols(cols, rows) }], {
      subtitle,
      kpis: [[t("stay.vis.kpiTotal"), t("common.people", { n: rows.length })]],
    });
  const filtered = sorted.length !== visitors.length;
  const room = roomId != null ? I.facilityById.get(roomId) : undefined;
  const hs = hsId != null ? I.homestayById.get(hsId) : undefined;
  const isHost = user?.role === "host";

  if (isLoading)
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Users />}
        title={t("stay.vis.title")}
        subtitle={
          isHost
            ? t("stay.vis.subtitleHost")
            : t("stay.vis.subtitle", { total: visitors.length, target: VIRTUAL.target.visitors, countries: stats.countries })
        }
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
              <MenuItem icon={<Download />} onSelect={() => exportCsv(allSortedByPid)}>
                {t("stay.vis.csvAll")}
              </MenuItem>
              {filtered && (
                <MenuItem icon={<Download />} onSelect={() => exportCsv(sorted, t("stay.vis.fileFiltered"))}>
                  {t("stay.vis.csvFiltered", { n: sorted.length })}
                </MenuItem>
              )}
              <MenuSep />
              <MenuItem icon={<Printer />} onSelect={() => printRows(t("stay.vis.printTitle", { parish: PARISH.name }), allSortedByPid)}>
                {t("stay.ui.printAll")}
              </MenuItem>
              {filtered && (
                <MenuItem
                  icon={<Printer />}
                  onSelect={() =>
                    printRows(
                      t("stay.vis.printTitleFiltered", { parish: PARISH.name }),
                      sorted,
                      q ? t("stay.vis.printSubSearch", { q }) : undefined,
                    )
                  }
                >
                  {t("stay.vis.printFiltered")}
                </MenuItem>
              )}
              <MenuItem icon={<Printer />} onSelect={() => setPrintOpen(true)}>
                {t("stay.vis.printGroups")}
              </MenuItem>
            </Menu>
            {editable && (
              <Button onClick={() => setPasteOpen(true)}>
                <ClipboardPaste />
                {t("stay.ui.paste")}
              </Button>
            )}
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label={t("stay.vis.statTotal")}
          value={t("common.people", { n: visitors.length })}
          hint={isHost ? undefined : t("stay.vis.statTotalHint", { target: VIRTUAL.target.visitors, countries: stats.countries })}
          onClick={() => setParam("kind", "all")}
        />
        <Stat label={t("stay.vis.statRoom")} value={num(I.inRoom)} tone="primary" onClick={() => setParam("kind", "room")} />
        <Stat label={t("stay.vis.statHs")} value={num(I.inHs)} tone="gold" onClick={() => setParam("kind", "hs")} />
        <Stat
          label={t("stay.vis.statNone")}
          value={num(I.unassigned)}
          tone={I.unassigned ? "warn" : undefined}
          onClick={() => setParam("kind", "none")}
        />
        <Stat
          label={t("stay.vis.statOrphan")}
          value={num(I.orphan)}
          tone={I.orphan ? "bad" : undefined}
          hint={I.orphan ? t("stay.vis.statOrphanHint") : t("common.none")}
          onClick={() => setParam("kind", "orphan")}
          className="max-lg:col-span-2 max-sm:col-span-1"
        />
      </div>

      <TeamRoster icon="🤝" title={t("stay.vis.teamTitle")} desc={t("stay.vis.teamDesc")} teamName="환대팀" keywords={["환대팀"]} />

      {stats.langs.length > 0 && (
        <Card className="p-4">
          <div className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Languages className="size-4 text-ink-3" />
            {t("stay.vis.langStats")} <span className="text-[12.5px] font-normal text-ink-3">{t("stay.vis.langStatsSub")}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.langs.map(([l, n]) => (
              <Badge key={l} tone="gray">
                {l || t("stay.vis.langUnset")} {t("common.people", { n })}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* 도구 모음(검색·필터) */}
      <Card className="space-y-2.5 p-3 lg:sticky lg:top-[4.5rem] lg:z-10">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={(v) => setParam("q", v)} placeholder={t("stay.vis.search")} className="min-w-56 flex-1" />
          {zones.length > 0 && (
            <Select aria-label={t("stay.col.zone")} value={zone} onChange={(e) => setParam("zone", e.target.value)} className="w-44">
              <option value="">{t("stay.ui.zoneAll", { count: zones.length })}</option>
              {zones.map(([z, n]) => (
                <option key={z} value={z}>
                  {z} ({n})
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[12.5px] text-ink-3">{t("stay.vis.filterStay")}</span>
          <Segmented
            value={kind}
            onChange={(v) => setParam("kind", v)}
            options={[
              { value: "all", label: t("common.all"), count: visitors.length },
              { value: "none", label: t("stay.place.unassigned"), count: I.unassigned },
              { value: "room", label: t("stay.place.roomKind"), count: I.inRoom },
              { value: "hs", label: t("stay.place.hsKind"), count: I.inHs },
              ...(I.orphan || kind === "orphan" ? [{ value: "orphan" as const, label: t("stay.place.orphan"), count: I.orphan }] : []),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[12.5px] text-ink-3">{t("stay.vis.filterGroup")}</span>
          <Segmented
            value={group}
            onChange={(v) => setParam("group", v)}
            options={VIS_GROUPS.map(([value, key]) => ({ value, label: t(key) }))}
          />
        </div>
        {(room || hs || roomId != null || hsId != null) && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue" className="py-1 text-[12.5px]">
              {roomId != null
                ? t("stay.vis.chipRoom", { label: room ? roomLabel(room) : "#" + roomId })
                : t("stay.vis.chipHs", { label: hs ? hsLabel(hs) : "#" + hsId })}
              <button
                type="button"
                aria-label={t("stay.vis.chipClear")}
                onClick={() => {
                  setParam("room", "");
                  setParam("hs", "");
                }}
                className="ml-1 rounded hover:text-ink"
              >
                <X />
              </button>
            </Badge>
            {hs && (
              <Button size="sm" variant="ghost" onClick={() => navigate(`/homestays?focus=${hs.id}&from=visitors`)}>
                {t("stay.vis.viewHs")}
              </Button>
            )}
          </div>
        )}
      </Card>

      {group !== "none" && <p className="-mt-1 px-1 text-[12px] text-ink-3">{t("stay.vis.groupTip", { group: groupLabel })}</p>}

      <Pager total={list.length} unit="people" page={pg.p} size={size} onPage={setPage} onSize={setSize} />

      {!visitors.length ? (
        <Card>
          <Empty icon={<Users />} title={isHost ? t("stay.vis.emptyHost") : t("stay.vis.empty")}>
            {editable ? t("stay.vis.emptyHint") : null}
          </Empty>
        </Card>
      ) : !list.length ? (
        <Card>
          <Empty title={t("stay.vis.noMatch")}>{t("stay.ui.noMatchHint")}</Empty>
        </Card>
      ) : grouped ? (
        <div className="space-y-3">
          {chunkBy(pageRows, (v) => keyOf(v, group)).map(([k, rows], i) => (
            <Card key={k + i} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
                <b className="text-[14px] text-ink">{k}</b>
                <span className="text-[12.5px] text-ink-3">· {t("common.people", { n: grouped.count.get(k) || 0 })}</span>
                <span className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const all = list.filter((v) => keyOf(v, group) === k);
                    printRows(
                      t("stay.vis.printTitleGroup", { parish: PARISH.name, group: groupLabel, key: k }),
                      all,
                      t("stay.vis.printSubGroup", { group: groupLabel, total: t("common.people", { n: all.length }) }),
                    );
                  }}
                >
                  <Printer />
                  {t("common.print")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    exportCsv(
                      list.filter((v) => keyOf(v, group) === k),
                      `_${groupLabel}_${k}`,
                    )
                  }
                >
                  <Download />
                  CSV
                </Button>
              </div>
              {/* 여러 표가 한 화면에 있으므로 가상화 끔(isExpanded 항상 참, 펼침 내용 없음) */}
              <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} dense isExpanded={() => true} renderExpanded={() => null} />
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <DataTable rows={pageRows} columns={columns} rowKey={(r) => r.id} dense />
        </Card>
      )}

      {pg.pages > 1 && <Pager total={list.length} unit="people" page={pg.p} size={size} onPage={setPage} onSize={setSize} />}

      <VisitorEditDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} row={edit?.row ?? null} />
      {isAdmin && <AutoAssignDialog open={aaOpen} onOpenChange={setAaOpen} />}
      {editable && <PasteImport def={paste} open={pasteOpen} onOpenChange={setPasteOpen} />}
      <PrintPicker
        open={printOpen}
        onOpenChange={setPrintOpen}
        label={t("stay.vis.printLabel")}
        unit="people"
        groupers={PRINT_GROUPERS.map((g) => [g, t(VIS_GROUP_LABEL[g])])}
        keyOf={keyOf}
        rows={printRowsAll}
        cols={cols}
      />
      <RoomGuestsDialog
        room={roomView}
        I={I}
        onClose={() => setRoomView(null)}
        onFilter={(f) => {
          setRoomView(null);
          setSp(new URLSearchParams({ room: String(f.id) }));
        }}
      />
    </div>
  );
}

/** 화면 정렬 기준의 전체 방문자(선택 인쇄용 — 필터 무관) */
function sortedAll(visitors: Visitor[], sort: SortState<SortKey>, I: StayIndex, tr: Tr) {
  return sortBy(visitors.slice(), (v) => (sort.key === "room" ? stayText(v, I, tr) : (v as any)[sort.key]), sort.dir);
}
/** 연속된 같은 키끼리 묶기(현재 쪽의 묶음 제목) */
function chunkBy<T>(rows: T[], key: (r: T) => string): [string, T[]][] {
  const out: [string, T[]][] = [];
  for (const r of rows) {
    const k = key(r);
    const last = out[out.length - 1];
    if (last && last[0] === k) last[1].push(r);
    else out.push([k, [r]]);
  }
  return out;
}

function useVisitorColumns({
  I,
  sort,
  setSort,
  editable,
  onEdit,
  onRoom,
  onHs,
}: {
  I: StayIndex;
  sort: SortState<SortKey>;
  setSort: (s: SortState<SortKey>) => void;
  editable: boolean;
  onEdit: (v: Visitor) => void;
  onRoom: (f: Facility) => void;
  onHs: (id: number) => void;
}): Column<Visitor>[] {
  const { t } = useT();
  return useMemo(() => {
    const H = (k: SortKey, l: MsgKey) => <SortHead k={k} label={t(l)} sort={sort} onSort={setSort} />;
    const cols: Column<Visitor>[] = [
      {
        key: "pid",
        header: H("pid", "stay.col.pid"),
        cell: (x) => <span className="font-semibold whitespace-nowrap">{x.pid || "—"}</span>,
      },
      { key: "gno", header: H("gno", "stay.col.gno"), cell: (x) => (x.gno ? <Badge tone="blue">{x.gno}</Badge> : <Dash />) },
      { key: "name", header: H("name", "stay.col.name"), cell: (x) => <span className="font-semibold whitespace-nowrap">{x.name}</span> },
      { key: "sex", header: H("sex", "stay.col.sex"), cell: (x) => <SexTag sex={x.sex} /> },
      {
        key: "country",
        header: H("country", "stay.col.country"),
        cell: (x) => <span className="whitespace-nowrap">{x.country || "—"}</span>,
      },
      {
        key: "lang",
        header: H("lang", "stay.col.lang"),
        cell: (x) => <span className="whitespace-nowrap">{x.lang || "—"}</span>,
        hideOnMobile: true,
      },
      {
        key: "room",
        header: H("room", "stay.col.stayPlace"),
        className: "min-w-36",
        cell: (x) => <StayCell v={x} I={I} onRoom={onRoom} onHs={onHs} />,
      },
      { key: "stay", header: H("stay", "stay.col.period"), cell: (x) => <span className="whitespace-nowrap">{x.stay || "—"}</span> },
      {
        key: "role",
        header: H("role", "stay.col.role"),
        cell: (x) => (x.role ? <Badge tone="green">{x.role}</Badge> : <Dash />),
        hideOnMobile: true,
      },
      { key: "status", header: H("status", "stay.col.status"), cell: (x) => <VisStatus s={x.status} /> },
      {
        key: "note",
        header: H("note", "stay.col.note"),
        className: "min-w-28 max-w-64 text-ink-3",
        cell: (x) => (
          <span className="line-clamp-2 whitespace-pre-wrap" title={x.note}>
            {x.note || "—"}
          </span>
        ),
        hideOnMobile: true,
      },
      { key: "tel", header: t("stay.col.tel"), cell: (x) => <Tel tel={x.tel} /> },
    ];
    if (editable)
      cols.push({
        key: "edit",
        header: <span className="sr-only">{t("stay.ui.manage")}</span>,
        cell: (x) => (
          <Button size="sm" variant="ghost" onClick={() => onEdit(x)}>
            {t("stay.ui.edit")}
          </Button>
        ),
      });
    return cols;
  }, [I, sort, setSort, editable, onEdit, onRoom, onHs, t]);
}

/** 숙박 장소 칸: 🏠 H번호 + 대표자(홈스테이 화면으로) / 교리실 배지(숙박자 보기) / 연결 끊김 / 미배정 */
function StayCell({ v, I, onRoom, onHs }: { v: Visitor; I: StayIndex; onRoom: (f: Facility) => void; onHs: (id: number) => void }) {
  const tr = useT();
  const { t } = tr;
  const k = placeKind(v, I);
  if (k === "room") {
    const f = visFacility(v, I)!;
    return (
      <button type="button" onClick={() => onRoom(f)} title={t("stay.vis.cellRoomTitle")} className="rounded-md hover:opacity-80">
        <Badge tone="blue">{roomLabel(f)}</Badge>
      </button>
    );
  }
  if (k === "hs") {
    const h = visHomestay(v, I)!;
    return (
      <button
        type="button"
        onClick={() => onHs(h.id)}
        title={t("stay.vis.cellHsTitle")}
        className="inline-flex items-center gap-1.5 rounded-md text-left hover:opacity-80"
      >
        <Badge tone="amber">🏠 {h.hid || t("stay.vis.noHid")}</Badge>
        <span className="text-[13px] whitespace-nowrap text-ink-2">{h.host}</span>
      </button>
    );
  }
  if (k === "orphan") return <span className="text-[13px] text-bad">{t("stay.place.orphanWith", { text: orphanText(v, I, tr) })}</span>;
  return <span className="text-[13px] text-warn">{t("stay.place.unassigned")}</span>;
}

/** 교리실 숙박 방문자 보기(방문자 명단의 배정 교리실과 연동) */
function RoomGuestsDialog({
  room,
  I,
  onClose,
  onFilter,
}: {
  room: Facility | null;
  I: StayIndex;
  onClose: () => void;
  onFilter: (f: Facility) => void;
}) {
  const { t } = useT();
  const ps = room ? (I.byFacility.get(room.id) || []).slice().sort((a, b) => cmp(a.pid, b.pid)) : [];
  return (
    <Dialog
      open={!!room}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={room ? t("stay.vis.roomDlgTitle", { room: roomLabel(room) }) : ""}
      description={
        room
          ? t("stay.vis.roomDlgDesc", { n: ps.length, cap: room.cap ? t("stay.guest.capPart", { cap: Number(room.cap) }) : "" })
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => room && onFilter(room)}>
            {t("stay.vis.roomDlgFilter")}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </>
      }
    >
      {ps.length ? (
        <ul className="divide-y divide-line">
          {ps.map((p) => (
            <li key={p.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{p.pid || "—"}</Badge>
                {p.gno && <Badge tone="blue">{p.gno}</Badge>}
                <b className="text-ink">{p.name}</b>
                <SexTag sex={p.sex} />
                <span className="text-[12.5px] text-ink-3">
                  {p.country} · {p.lang}
                </span>
                <VisStatus s={p.status} />
              </div>
              <div className="mt-1 text-[12.5px] text-ink-2">
                {t("stay.vis.telLabel")} <Tel tel={p.tel} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-[13px] text-ink-3">{t("stay.ui.roomEmpty")}</p>
      )}
    </Dialog>
  );
}
