import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ClipboardPaste, Download, FileDown, Languages, Plus, Printer, Users, X, Zap } from "lucide-react";
import { normSex, PARISH, VIRTUAL, type Facility, type StayIndex, type Visitor } from "@wyd/shared";
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
import { cmp, matchQuery, num } from "@/lib/utils";
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
  type VisGroupBy,
} from "@/components/stay/stay";

type SortKey = "pid" | "gno" | "name" | "sex" | "country" | "lang" | "room" | "stay" | "role" | "status" | "note";
type KindFilter = "all" | PlaceKind;

const PASTE: PasteDef = {
  label: "방문자(순례자)",
  table: "visitors",
  cols: [
    ["gno", "그룹(G1)"],
    ["name", "이름"],
    ["sex", "성별(남/여)"],
    ["country", "국가"],
    ["lang", "언어"],
    ["stay", "기간"],
    ["role", "역할"],
    ["status", "상태"],
    ["tel", "연락처"],
    ["note", "비고"],
  ],
  // 성별 표기(남자·M·female 등) 정규화, 상태 비면 기본값
  mapRow: (o) => ({ ...o, sex: normSex(o.sex), ...(o.status ? {} : { status: "확정" }) }),
};
const PRINT_GROUPERS: [string, string][] = [
  ["gno", "그룹"],
  ["country", "국가"],
  ["sex", "성별"],
  ["lang", "언어"],
  ["stay", "기간"],
  ["status", "상태"],
  ["stayplace", "숙소"],
];

export default function Visitors() {
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
    const val = (v: Visitor) => (sort.key === "room" ? stayText(v, I) : (v as any)[sort.key]);
    return list.sort((a, b) => cmp(val(a), val(b)) * sort.dir);
  }, [visitors, I, kind, zone, roomId, hsId, dq, hay, sort]);

  // 묶어보기: 필터 결과 전체 기준으로 묶음 순서·인원을 구하고, 현재 쪽만 소제목과 함께 표시
  const keyOf = useCallback((v: Visitor, by: string) => visGroupKey(v, by as VisGroupBy, I), [I]);
  const grouped = useMemo(() => {
    if (group === "none") return null;
    const { order, count } = groupOrder(sorted, (v) => keyOf(v, group));
    const rank = new Map(order.map((k, i) => [k, i]));
    const ordered = sorted.slice().sort((a, b) => rank.get(keyOf(a, group))! - rank.get(keyOf(b, group))!);
    return { ordered, count };
  }, [sorted, group, keyOf]);
  const list = grouped?.ordered ?? sorted;
  const pg = usePage(list.length, page, size);
  const pageRows = list.slice(pg.start, pg.end);

  const stats = useMemo(() => {
    const lang = new Map<string, number>();
    visitors.forEach((x) => lang.set(x.lang || "미입력", (lang.get(x.lang || "미입력") || 0) + 1));
    return { langs: [...lang].sort((a, b) => b[1] - a[1]), countries: new Set(visitors.map((x) => x.country).filter(Boolean)).size };
  }, [visitors]);
  const allSortedByPid = useMemo(() => visitors.slice().sort((a, b) => cmp(a.pid, b.pid)), [visitors]);
  const cols = useMemo(() => visitorCols(I), [I]);
  const printRowsAll = useMemo(() => sortedAll(visitors, sort, I), [visitors, sort, I]);

  const columns = useVisitorColumns({
    I,
    sort,
    setSort,
    editable,
    onEdit: (row) => setEdit({ row }),
    onRoom: setRoomView,
    onHs: (id) => void navigate(`/homestays?focus=${id}&from=visitors`),
  });

  const exportCsv = (rows: Visitor[], suffix = "") =>
    downloadCSV(
      `${PARISH.name}_방문자${suffix}`,
      cols.map((c) => c[0]),
      applyCols(cols, rows),
    );
  const printRows = (title: string, rows: Visitor[], subtitle?: string) =>
    printDocument(title, [{ columns: cols.map((c) => c[0]), rows: applyCols(cols, rows) }], {
      subtitle,
      kpis: [["총", rows.length + "명"]],
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
        title="방문자(순례자) 명단"
        subtitle={
          isHost
            ? "우리 가정에 배정된 방문자"
            : `1인 1행 · 총 ${num(visitors.length)}명 / 목표 ${num(VIRTUAL.target.visitors)}명 · ${stats.countries}개국 · 검색·숙소 필터·쪽 단위 표시`
        }
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
              <MenuItem icon={<Download />} onSelect={() => exportCsv(allSortedByPid)}>
                전체 CSV 내려받기
              </MenuItem>
              {filtered && (
                <MenuItem icon={<Download />} onSelect={() => exportCsv(sorted, "_검색결과")}>
                  검색 결과만 CSV ({num(sorted.length)}명)
                </MenuItem>
              )}
              <MenuSep />
              <MenuItem icon={<Printer />} onSelect={() => printRows(`${PARISH.name} 방문자(순례자) 명단`, allSortedByPid)}>
                전체 인쇄 / PDF
              </MenuItem>
              {filtered && (
                <MenuItem
                  icon={<Printer />}
                  onSelect={() => printRows(`${PARISH.name} 방문자 명단 · 검색 결과`, sorted, q ? `검색: ${q}` : undefined)}
                >
                  검색 결과만 인쇄
                </MenuItem>
              )}
              <MenuItem icon={<Printer />} onSelect={() => setPrintOpen(true)}>
                묶음별 선택 인쇄…
              </MenuItem>
            </Menu>
            {editable && (
              <Button onClick={() => setPasteOpen(true)}>
                <ClipboardPaste />
                엑셀 붙여넣기
              </Button>
            )}
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="총 방문자"
          value={`${num(visitors.length)}명`}
          hint={isHost ? undefined : `목표 ${num(VIRTUAL.target.visitors)}명 · ${stats.countries}개국`}
          onClick={() => setParam("kind", "all")}
        />
        <Stat label="교리실 배정" value={num(I.inRoom)} tone="primary" onClick={() => setParam("kind", "room")} />
        <Stat label="홈스테이 배정" value={num(I.inHs)} tone="gold" onClick={() => setParam("kind", "hs")} />
        <Stat label="미배정" value={num(I.unassigned)} tone={I.unassigned ? "warn" : undefined} onClick={() => setParam("kind", "none")} />
        <Stat
          label="연결 끊김"
          value={num(I.orphan)}
          tone={I.orphan ? "bad" : undefined}
          hint={I.orphan ? "편집에서 숙소를 다시 지정" : "없음"}
          onClick={() => setParam("kind", "orphan")}
          className="max-lg:col-span-2 max-sm:col-span-1"
        />
      </div>

      <TeamRoster
        icon="🤝"
        title="환대팀 명단"
        desc="순례자 관리·소통, 입소식·퇴소식, 통역 배정, 숙소 배치·안내 (3~4명)"
        teamName="환대팀"
        keywords={["환대팀"]}
      />

      {stats.langs.length > 0 && (
        <Card className="p-4">
          <div className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Languages className="size-4 text-ink-3" />
            언어별 집계 <span className="text-[12.5px] font-normal text-ink-3">소통 담당·통역 배치 기준</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.langs.map(([l, n]) => (
              <Badge key={l} tone="gray">
                {l} {num(n)}명
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* 도구 모음(검색·필터) */}
      <Card className="space-y-2.5 p-3 lg:sticky lg:top-[4.5rem] lg:z-10">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={(v) => setParam("q", v)}
            placeholder="검색: 이름·번호·그룹·국가·언어·연락처·숙소 (띄어쓰기로 여러 조건)"
            className="min-w-56 flex-1"
          />
          {zones.length > 0 && (
            <Select aria-label="구역" value={zone} onChange={(e) => setParam("zone", e.target.value)} className="w-44">
              <option value="">전체 구역 ({zones.length})</option>
              {zones.map(([z, n]) => (
                <option key={z} value={z}>
                  {z} ({n})
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[12.5px] text-ink-3">숙소</span>
          <Segmented
            value={kind}
            onChange={(v) => setParam("kind", v)}
            options={[
              { value: "all", label: "전체", count: visitors.length },
              { value: "none", label: "미배정", count: I.unassigned },
              { value: "room", label: "교리실", count: I.inRoom },
              { value: "hs", label: "홈스테이", count: I.inHs },
              ...(I.orphan || kind === "orphan" ? [{ value: "orphan" as const, label: "연결 끊김", count: I.orphan }] : []),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[12.5px] text-ink-3">묶어보기</span>
          <Segmented
            value={group}
            onChange={(v) => setParam("group", v)}
            options={VIS_GROUPS.map(([value, label]) => ({ value, label }))}
          />
        </div>
        {(room || hs || roomId != null || hsId != null) && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue" className="py-1 text-[12.5px]">
              {roomId != null ? `교리실: ${room ? roomLabel(room) : "#" + roomId}` : `홈스테이: ${hs ? hsLabel(hs) : "#" + hsId}`}
              <button
                type="button"
                aria-label="숙소 조건 지우기"
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
                이 가정 정보 보기 ›
              </Button>
            )}
          </div>
        )}
      </Card>

      {group !== "none" && (
        <p className="-mt-1 px-1 text-[12px] text-ink-3">
          💡 각 {VIS_GROUP_LABEL[group]} 제목줄의 <b>인쇄</b> / <b>CSV</b> 버튼으로 해당 {VIS_GROUP_LABEL[group]}만 따로 출력할 수 있습니다.
        </p>
      )}

      <Pager total={list.length} unit="명" page={pg.p} size={size} onPage={setPage} onSize={setSize} />

      {!visitors.length ? (
        <Card>
          <Empty icon={<Users />} title={isHost ? "아직 배정된 방문자가 없습니다" : "등록된 방문자가 없습니다"}>
            {editable ? "＋ 추가 또는 엑셀 붙여넣기로 방문자를 등록하세요." : null}
          </Empty>
        </Card>
      ) : !list.length ? (
        <Card>
          <Empty title="조건에 맞는 방문자가 없습니다.">검색어나 필터를 바꿔 보세요.</Empty>
        </Card>
      ) : grouped ? (
        <div className="space-y-3">
          {chunkBy(pageRows, (v) => keyOf(v, group)).map(([k, rows], i) => (
            <Card key={k + i} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
                <b className="text-[14px] text-ink">{k}</b>
                <span className="text-[12.5px] text-ink-3">· {num(grouped.count.get(k) || 0)}명</span>
                <span className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const all = list.filter((v) => keyOf(v, group) === k);
                    printRows(
                      `${PARISH.name} 방문자 명단 · ${VIS_GROUP_LABEL[group]} [${k}]`,
                      all,
                      `${VIS_GROUP_LABEL[group]} 기준 · 총 ${all.length}명`,
                    );
                  }}
                >
                  <Printer />
                  인쇄
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    exportCsv(
                      list.filter((v) => keyOf(v, group) === k),
                      `_${VIS_GROUP_LABEL[group]}_${k}`,
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

      {pg.pages > 1 && <Pager total={list.length} unit="명" page={pg.p} size={size} onPage={setPage} onSize={setSize} />}

      <VisitorEditDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} row={edit?.row ?? null} />
      {isAdmin && <AutoAssignDialog open={aaOpen} onOpenChange={setAaOpen} />}
      {editable && <PasteImport def={PASTE} open={pasteOpen} onOpenChange={setPasteOpen} />}
      <PrintPicker
        open={printOpen}
        onOpenChange={setPrintOpen}
        label="방문자"
        unit="명"
        groupers={PRINT_GROUPERS}
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
function sortedAll(visitors: Visitor[], sort: SortState<SortKey>, I: StayIndex) {
  const val = (v: Visitor) => (sort.key === "room" ? stayText(v, I) : (v as any)[sort.key]);
  return visitors.slice().sort((a, b) => cmp(val(a), val(b)) * sort.dir);
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
  return useMemo(() => {
    const H = (k: SortKey, l: string) => <SortHead k={k} label={l} sort={sort} onSort={setSort} />;
    const cols: Column<Visitor>[] = [
      { key: "pid", header: H("pid", "번호"), cell: (x) => <span className="font-semibold whitespace-nowrap">{x.pid || "—"}</span> },
      { key: "gno", header: H("gno", "그룹"), cell: (x) => (x.gno ? <Badge tone="blue">{x.gno}</Badge> : <Dash />) },
      { key: "name", header: H("name", "이름"), cell: (x) => <span className="font-semibold whitespace-nowrap">{x.name}</span> },
      { key: "sex", header: H("sex", "성별"), cell: (x) => <SexTag sex={x.sex} /> },
      { key: "country", header: H("country", "국가"), cell: (x) => <span className="whitespace-nowrap">{x.country || "—"}</span> },
      {
        key: "lang",
        header: H("lang", "언어"),
        cell: (x) => <span className="whitespace-nowrap">{x.lang || "—"}</span>,
        hideOnMobile: true,
      },
      {
        key: "room",
        header: H("room", "숙박 장소"),
        className: "min-w-36",
        cell: (x) => <StayCell v={x} I={I} onRoom={onRoom} onHs={onHs} />,
      },
      { key: "stay", header: H("stay", "기간"), cell: (x) => <span className="whitespace-nowrap">{x.stay || "—"}</span> },
      {
        key: "role",
        header: H("role", "역할"),
        cell: (x) => (x.role ? <Badge tone="green">{x.role}</Badge> : <Dash />),
        hideOnMobile: true,
      },
      { key: "status", header: H("status", "상태"), cell: (x) => <VisStatus s={x.status} /> },
      {
        key: "note",
        header: H("note", "비고"),
        className: "min-w-28 max-w-64 text-ink-3",
        cell: (x) => (
          <span className="line-clamp-2 whitespace-pre-wrap" title={x.note}>
            {x.note || "—"}
          </span>
        ),
        hideOnMobile: true,
      },
      { key: "tel", header: "연락처", cell: (x) => <Tel tel={x.tel} /> },
    ];
    if (editable)
      cols.push({
        key: "edit",
        header: <span className="sr-only">관리</span>,
        cell: (x) => (
          <Button size="sm" variant="ghost" onClick={() => onEdit(x)}>
            편집
          </Button>
        ),
      });
    return cols;
  }, [I, sort, setSort, editable, onEdit, onRoom, onHs]);
}

/** 숙박 장소 칸: 🏠 H번호 + 대표자(홈스테이 화면으로) / 교리실 배지(숙박자 보기) / 연결 끊김 / 미배정 */
function StayCell({ v, I, onRoom, onHs }: { v: Visitor; I: StayIndex; onRoom: (f: Facility) => void; onHs: (id: number) => void }) {
  const k = placeKind(v, I);
  if (k === "room") {
    const f = visFacility(v, I)!;
    return (
      <button type="button" onClick={() => onRoom(f)} title="이 교리실 숙박자 보기" className="rounded-md hover:opacity-80">
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
        title="홈스테이 화면에서 이 가정 보기"
        className="inline-flex items-center gap-1.5 rounded-md text-left hover:opacity-80"
      >
        <Badge tone="amber">🏠 {h.hid || "번호없음"}</Badge>
        <span className="text-[13px] whitespace-nowrap text-ink-2">{h.host}</span>
      </button>
    );
  }
  if (k === "orphan") return <span className="text-[13px] text-bad">연결 끊김({orphanText(v, I)})</span>;
  return <span className="text-[13px] text-warn">미배정</span>;
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
  const ps = room ? (I.byFacility.get(room.id) || []).slice().sort((a, b) => cmp(a.pid, b.pid)) : [];
  return (
    <Dialog
      open={!!room}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={room ? `${roomLabel(room)} · 숙박 방문자` : ""}
      description={room ? `총 ${ps.length}명${room.cap ? ` / 수용 ${room.cap}명` : ""} · 방문자 명단의 '배정 교리실'과 연동` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => room && onFilter(room)}>
            이 교리실만 목록에서 보기 ›
          </Button>
          <Button variant="primary" onClick={onClose}>
            닫기
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
                연락처: <Tel tel={p.tel} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-[13px] text-ink-3">이 교리실에 배정된 방문자가 없습니다.</p>
      )}
    </Dialog>
  );
}
