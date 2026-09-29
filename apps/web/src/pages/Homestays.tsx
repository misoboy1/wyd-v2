import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronUp, ClipboardPaste, Download, FileDown, Home, Pencil, Plus, Printer, X, Zap } from "lucide-react";
import { famText, hsCaps, PARISH, reqSex, SCALE, zoneApt, type Homestay, type StayIndex, type Visitor } from "@wyd/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, SearchInput } from "@/components/ui/input";
import { Menu, MenuItem, MenuSep } from "@/components/ui/menu";
import { Empty, PageHeader, Segmented, Skeleton, Stat } from "@/components/ui/misc";
import { DataTable, type Column } from "@/components/ui/table";
import { EditDialog } from "@/components/form/EditDialog";
import { PasteImport, type PasteDef } from "@/components/form/PasteImport";
import { useCan } from "@/lib/auth";
import { downloadCSV } from "@/lib/csv";
import { printDocument } from "@/lib/print";
import { cmp, cn, matchQuery, num } from "@/lib/utils";
import { useStayIndex } from "@/components/stay/useStayIndex";
import { GuestList } from "@/components/stay/GuestList";
import { VisitorEditDialog } from "@/components/stay/VisitorEditDialog";
import { AutoAssignDialog } from "@/components/stay/AutoAssignDialog";
import { PrintPicker } from "@/components/stay/PrintPicker";
import { TeamRoster } from "@/components/stay/TeamRoster";
import { Dash, FamBadges, HsStatus, Pager, ReqSexBadge, SortHead, Tel, usePage, type SortState } from "@/components/stay/bits";
import { applyCols, dupHosts, homestayCols, hsFill, hsLabel, sexSummary, type HsFill } from "@/components/stay/stay";

type SortKey = "hid" | "zone" | "zoneApt" | "host" | "addr" | "tel" | "family" | "lang" | "period" | "cap" | "reqSex" | "status" | "note";
const NUMERIC = ["mAdult", "fAdult", "mStu", "fStu", "mYng", "fYng", "cap"];
const PASTE: PasteDef = {
  label: "홈스테이 가정", table: "homestays",
  cols: [["host", "가정(대표자)"], ["zone", "구역"], ["addr", "주소"], ["tel", "연락처"], ["mAdult", "성인남"], ["fAdult", "성인여"], ["mStu", "남학생"], ["fStu", "여학생"], ["mYng", "남청년"], ["fYng", "여청년"], ["lang", "언어"], ["cap", "수용"], ["period", "기간"], ["status", "상태"], ["note", "비고"]],
  // 숫자 칸: "2명" 같은 표기도 숫자만 남김
  mapRow: (o) => {
    const r: Record<string, any> = { ...o };
    NUMERIC.forEach((k) => { if (r[k] != null) { const d = String(r[k]).replace(/[^\d.]/g, ""); r[k] = d === "" ? null : Number(d); } });
    return r;
  },
};
const PRINT_GROUPERS: [string, string][] = [["zone", "구역"], ["zoneApt", "단지"]];
const printKey = (h: Homestay, by: string) => (by === "zone" ? h.zone || "미지정" : zoneApt(h.zone) || "미지정");
const NEW_HS = { status: "제안" };

function sortVal(h: Homestay, k: SortKey): unknown {
  if (k === "cap") return hsCaps(h).cap;
  if (k === "zoneApt") return zoneApt(h.zone);
  if (k === "reqSex") return reqSex(h);
  if (k === "family") return famText(h, false);
  return (h as any)[k];
}

export default function Homestays() {
  const { I, homestays, isLoading } = useStayIndex();
  const { isAdmin, canWrite, user } = useCan();
  const editable = canWrite("homestays");
  const isHost = user?.role === "host";
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const fill = (sp.get("fill") ?? "all") as "all" | HsFill;
  const zone = sp.get("zone") ?? "";
  const focusId = sp.get("focus") ? Number(sp.get("focus")) : null;
  const fromVisitors = sp.get("from") === "visitors";
  const setParam = useCallback((k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); if (v && v !== "all") n.set(k, v); else n.delete(k); return n; }, { replace: true }), [setSp]);

  const [sort, setSort] = useState<SortState<SortKey>>({ key: "hid", dir: 1 });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(SCALE.defaultPage);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [edit, setEdit] = useState<{ row: Homestay | null } | null>(null);
  const [visEdit, setVisEdit] = useState<Visitor | null>(null);
  const [aaOpen, setAaOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const dq = useDeferredValue(q);
  useEffect(() => setPage(1), [dq, fill, zone, size, focusId]);

  const focus = focusId != null ? I.homestayById.get(focusId) : undefined;
  // 방문자 명단에서 가정 번호로 들어오면 그 가정 명단 자동 펼침 + 화면 이동
  useEffect(() => {
    if (!focus) return;
    setOpen((s) => new Set(s).add(focus.id));
    const t = setTimeout(() => document.querySelector(".hs-focus-row")?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
    return () => clearTimeout(t);
  }, [focus?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dup = useMemo(() => dupHosts(homestays), [homestays]);
  const kindCnt = useMemo(() => { const c = { none: 0, free: 0, full: 0, over: 0 }; homestays.forEach((h) => c[hsFill(h, I)]++); return c; }, [homestays, I]);
  const zones = useMemo(() => {
    const c = new Map<string, number>(); homestays.forEach((h) => { const z = h.zone || "미지정"; c.set(z, (c.get(z) || 0) + 1); });
    return [...c].sort((a, b) => cmp(a[0], b[0]));
  }, [homestays]);
  const kpi = useMemo(() => {
    const cap = homestays.filter((h) => h.status !== "퇴실").reduce((s, h) => s + hsCaps(h).cap, 0);
    return { cap, left: Math.max(0, cap - I.inHs) };
  }, [homestays, I]);

  const sorted = useMemo(() => {
    const list = focus ? [focus] : homestays.filter((h) => (fill === "all" || hsFill(h, I) === fill) && (!zone || (h.zone || "미지정") === zone)
      && matchQuery(dq, h.hid, h.host, h.zone, zoneApt(h.zone), h.addr, h.tel, h.lang, h.period, h.match, h.status, h.note));
    return list.slice().sort((a, b) => { const x = sortVal(a, sort.key), y = sortVal(b, sort.key); return (typeof x === "number" && typeof y === "number" ? x - y : cmp(x, y)) * sort.dir; });
  }, [homestays, I, focus, fill, zone, dq, sort]);
  const pg = usePage(sorted.length, page, size);
  const pageRows = sorted.slice(pg.start, pg.end);
  const pageAllOpen = pageRows.length > 0 && pageRows.every((h) => open.has(h.id));
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const cols = useMemo(() => homestayCols(I), [I]);
  const byHid = useMemo(() => homestays.slice().sort((a, b) => cmp(a.hid, b.hid)), [homestays]);
  const clearFocus = () => setSp((p) => { const n = new URLSearchParams(p); n.delete("focus"); n.delete("from"); return n; }, { replace: true });

  const columns = useMemo<Column<Homestay>[]>(() => {
    const H = (k: SortKey, l: string) => <SortHead k={k} label={l} sort={sort} onSort={setSort} />;
    const c: Column<Homestay>[] = [
      { key: "hid", header: H("hid", "번호"), cell: (h) => <span className="font-semibold whitespace-nowrap">{h.hid || "—"}</span> },
      { key: "zone", header: H("zone", "구역"), cell: (h) => (h.zone ? <Badge>{h.zone}</Badge> : <Dash />) },
      { key: "zoneApt", header: H("zoneApt", "아파트단지"), className: "min-w-28 text-[12.5px] text-ink-3", cell: (h) => zoneApt(h.zone), hideOnMobile: true },
      { key: "host", header: H("host", "가정"), cell: (h) => (
        <span className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap">{h.host}
          {dup.has(String(h.host || "").trim()) && <Badge tone="red" title="같은 이름의 가정이 있습니다. 세례명·구역으로 구분하세요.">동명</Badge>}</span>) },
      { key: "addr", header: H("addr", "주소"), className: "min-w-40", cell: (h) => h.addr || <Dash />, hideOnMobile: true },
      { key: "tel", header: H("tel", "연락처"), cell: (h) => <Tel tel={h.tel} /> },
      { key: "family", header: H("family", "가족 인원"), cell: (h) => <><span className="max-md:hidden"><FamBadges h={h} /></span><span className="text-[12.5px] whitespace-nowrap md:hidden">{famText(h, true)}</span></> },
      { key: "lang", header: H("lang", "언어"), cell: (h) => <span className="whitespace-nowrap">{h.lang || "—"}</span> },
      { key: "period", header: H("period", "기간"), cell: (h) => <span className="whitespace-nowrap">{h.period || "—"}</span>, hideOnMobile: true },
      { key: "cap", header: H("cap", "수용"), cell: (h) => <span className="tabular whitespace-nowrap">{hsCaps(h).cap || "—"}명</span> },
      { key: "reqSex", header: H("reqSex", "요청 성별"), cell: (h) => <ReqSexBadge h={h} /> },
      { key: "status", header: H("status", "상태"), cell: (h) => <HsStatus s={h.status} /> },
      { key: "note", header: H("note", "비고"), className: "min-w-28 max-w-60 text-ink-3", cell: (h) => <span className="line-clamp-2 whitespace-pre-wrap" title={h.note}>{h.note || "—"}</span>, hideOnMobile: true },
      { key: "guests", header: "숙박자", cell: (h) => <GuestsCell h={h} I={I} open={open.has(h.id)} onToggle={() => toggle(h.id)} /> },
    ];
    if (editable) c.push({ key: "edit", header: <span className="sr-only">관리</span>, cell: (h) => <Button size="sm" variant="ghost" onClick={() => setEdit({ row: h })}><Pencil />편집</Button> });
    return c;
  }, [sort, dup, I, open, editable]);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-9 w-56" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-96" /></div>;

  const focusGuests = focus ? I.byHomestay.get(focus.id)?.length || 0 : 0;

  return (
    <div className="space-y-4">
      <PageHeader icon={<Home />} title={isHost ? "우리 홈스테이 가정" : "홈스테이 가정 관리"}
        subtitle={isHost ? "우리 가정 정보와 배정된 방문자" : `총 ${num(homestays.length)}가정 / 최대 ${num(SCALE.homestays)}가정 · 검색·배정상태·구역 필터 · 열 제목 정렬`}
        actions={<>
          {fromVisitors && <Button variant="ghost" onClick={() => navigate(-1)}><ChevronLeft />방문자 명단으로</Button>}
          <Menu trigger={<Button><FileDown />내보내기</Button>}>
            <MenuItem icon={<Download />} onSelect={() => downloadCSV(`${PARISH.name}_홈스테이`, cols.map((c) => c[0]), applyCols(cols, byHid))}>CSV 내려받기</MenuItem>
            <MenuSep />
            <MenuItem icon={<Printer />} onSelect={() => printDocument(`${PARISH.name} 홈스테이 가정 명단`, [{ columns: cols.map((c) => c[0]), rows: applyCols(cols, byHid) }],
              { kpis: [["등록 가정", num(homestays.length)], ["총 수용", num(kpi.cap) + "명"], ["배정", num(I.inHs) + "명"]] })}>전체 인쇄 / PDF</MenuItem>
            {!isHost && <MenuItem icon={<Printer />} onSelect={() => setPrintOpen(true)}>구역·단지별 선택 인쇄…</MenuItem>}
          </Menu>
          {editable && <Button onClick={() => setPasteOpen(true)}><ClipboardPaste />엑셀 붙여넣기</Button>}
          {isAdmin && <Button variant="soft" onClick={() => setAaOpen(true)}><Zap />자동 배정</Button>}
          {editable && <Button variant="primary" onClick={() => setEdit({ row: null })}><Plus />추가</Button>}
        </>} />

      <TeamRoster icon="🏠" title="홈스테이팀 명단" desc="가정 모집·호스트 교육·참가자-가정 소통 담당 (3~4명)" teamName="홈스테이팀" keywords={["홈스테이"]} />

      {!isHost && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="등록 가정" value={<>{num(homestays.length)}<span className="text-[13px] font-medium text-ink-3"> / {num(SCALE.homestays)}</span></>} onClick={() => setParam("fill", "all")} />
          <Stat label="총 수용 (퇴실 제외)" value={`${num(kpi.cap)}명`} />
          <Stat label="배정 인원" value={`${num(I.inHs)}명`} tone="good" />
          <Stat label="잔여 수용" value={`${num(kpi.left)}명`} />
          <Stat label="미배정 가정" value={num(kindCnt.none)} tone={kindCnt.none ? "warn" : undefined} onClick={() => setParam("fill", "none")} className="max-lg:col-span-2 max-sm:col-span-1" />
        </div>
      )}

      {dup.size > 0 && !isHost && (
        <div className="flex gap-2.5 rounded-2xl border border-bad/30 bg-bad-soft/60 p-3.5 text-[13.5px] text-ink-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" />
          <div><b className="text-bad">동명 가정 {dup.size}건</b> — 대표자 이름이 같은 가정이 있습니다. 배정은 가정 번호(H번호)로 구분되지만, 혼동 방지를 위해 세례명·동호수 등을 이름에 덧붙여 주세요.</div>
        </div>
      )}

      {!isHost && (
        <Card className="space-y-2.5 p-3 lg:sticky lg:top-[4.5rem] lg:z-10">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={q} onChange={(v) => setParam("q", v)} placeholder="검색: 가정명·번호·구역·단지·주소·연락처·언어" className="min-w-56 flex-1" />
            <Select aria-label="구역" value={zone} onChange={(e) => setParam("zone", e.target.value)} className="w-44">
              <option value="">전체 구역 ({zones.length})</option>
              {zones.map(([z, n]) => <option key={z} value={z}>{z} ({n})</option>)}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[12.5px] text-ink-3">배정</span>
            <Segmented value={fill} onChange={(v) => setParam("fill", v)} options={[
              { value: "all", label: "전체", count: homestays.length }, { value: "none", label: "미배정", count: kindCnt.none },
              { value: "free", label: "여유", count: kindCnt.free }, { value: "full", label: "만실", count: kindCnt.full },
              ...(kindCnt.over || fill === "over" ? [{ value: "over" as const, label: "초과", count: kindCnt.over }] : []),
            ]} />
          </div>
        </Card>
      )}

      {focus && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/40 bg-primary-soft/60 px-4 py-3 text-[13.5px]">
          <span>🏠 <b className="text-ink">{hsLabel(focus)}</b> 가정만 표시 중 · 숙박자 {focusGuests}/{hsCaps(focus).cap || "—"}명</span>
          <span className="flex-1" />
          <Button size="sm" variant="secondary" onClick={clearFocus}><X />전체 가정 보기</Button>
          {fromVisitors && <Button size="sm" variant="primary" onClick={() => navigate(-1)}><ChevronLeft />방문자 명단으로</Button>}
        </div>
      )}
      {focusId != null && !focus && homestays.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-warn-soft px-4 py-2.5 text-[13px] text-warn">요청한 가정(#{focusId})을 찾을 수 없습니다. <Button size="sm" variant="ghost" onClick={clearFocus}>전체 가정 보기</Button></div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-[12.5px] text-ink-3">'숙박자'를 누르면 그 가정 밑에 방문자 명단(연동)이 펼쳐집니다.</span>
        {pageRows.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setOpen((s) => { const n = new Set(s); pageRows.forEach((h) => (pageAllOpen ? n.delete(h.id) : n.add(h.id))); return n; })}>
            {pageAllOpen ? <><ChevronUp />이 페이지 모두 접기</> : <><ChevronDown />이 페이지 모두 펼치기</>}
          </Button>
        )}
      </div>
      {!focus && <Pager total={sorted.length} unit="가정" page={pg.p} size={size} onPage={setPage} onSize={setSize} />}

      <Card className="overflow-hidden">
        <DataTable rows={pageRows} columns={columns} rowKey={(h) => h.id} dense
          isExpanded={(h) => open.has(h.id)}
          rowClassName={(h) => cn(focus?.id === h.id ? "hs-focus-row [&>td]:bg-primary-soft/70" : open.has(h.id) && "[&>td]:bg-primary-soft/30")}
          renderExpanded={(h) => (
            <GuestList title={hsLabel(h)} list={I.byHomestay.get(h.id) || []} cap={hsCaps(h).cap} emptyMsg="이 가정에 배정된 방문자가 없습니다."
              onGo={isHost ? undefined : () => navigate(`/visitors?hs=${h.id}`)} onEdit={setVisEdit} />
          )}
          empty={homestays.length
            ? <Empty title="조건에 맞는 가정이 없습니다.">검색어나 필터를 바꿔 보세요.</Empty>
            : <Empty icon={<Home />} title={isHost ? "연결된 홈스테이 가정이 없습니다" : "등록된 가정이 없습니다"}>{isHost ? "본당 관리자에게 계정과 가정 연결을 요청하세요." : editable ? "＋ 추가 또는 엑셀 붙여넣기로 가정을 등록하세요." : null}</Empty>} />
      </Card>
      {!focus && pg.pages > 1 && <Pager total={sorted.length} unit="가정" page={pg.p} size={size} onPage={setPage} onSize={setSize} />}

      {!isHost && <p className="px-1 text-[12px] leading-relaxed text-ink-3">※ 기본 정렬: 번호순. 열 제목을 누르면 해당 항목으로 오름/내림차순 전환됩니다. '아파트단지'는 구역별 지도를 참고해 자동 표시됩니다. 수용 인원이 비어 있으면 요청 성별 인원(학생+청년) 합계를 수용으로 봅니다.</p>}

      {editable && <HomestayEditDialog row={edit?.row ?? null} open={!!edit} onOpenChange={(o) => !o && setEdit(null)} all={homestays} />}
      <VisitorEditDialog open={!!visEdit} onOpenChange={(o) => !o && setVisEdit(null)} row={visEdit} />
      {isAdmin && <AutoAssignDialog open={aaOpen} onOpenChange={setAaOpen} />}
      {editable && <PasteImport def={PASTE} open={pasteOpen} onOpenChange={setPasteOpen} />}
      {!isHost && <PrintPicker open={printOpen} onOpenChange={setPrintOpen} label="홈스테이" unit="가정" groupers={PRINT_GROUPERS} keyOf={printKey} rows={sorted} cols={cols} />}
    </div>
  );
}

/** 숙박자 칸: 펼치기 버튼 + 성별 구성·배정/수용(초과 빨강) */
function GuestsCell({ h, I, open, onToggle }: { h: Homestay; I: StayIndex; open: boolean; onToggle: () => void }) {
  const ps = I.byHomestay.get(h.id) || [];
  const cap = hsCaps(h).cap, n = ps.length, over = cap > 0 && n > cap;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <Button size="sm" variant={open ? "soft" : "secondary"} className="h-7" onClick={onToggle} aria-expanded={open}>
        {open ? <><ChevronUp />접기</> : n ? <><ChevronDown />{n}명 보기</> : "배정 없음"}
      </Button>
      {n ? <span className={cn("text-[12px] tabular", over ? "font-semibold text-bad" : "text-ink-3")}>{sexSummary(ps)} · {n}/{cap || "—"}{over && " 초과"}</span>
        : cap ? <span className="text-[12px] text-ink-3 tabular">0/{cap}</span> : null}
    </div>
  );
}

/** 가정 추가·편집 — 같은 대표자명이 있으면 경고(500가정 규모 동명 혼동 방지) */
function HomestayEditDialog({ row, open, onOpenChange, all }: { row: Homestay | null; open: boolean; onOpenChange: (v: boolean) => void; all: Homestay[] }) {
  return (
    <EditDialog table="homestays" open={open} onOpenChange={onOpenChange} row={row} defaults={NEW_HS}
      title={row ? `편집 · 홈스테이 가정 ${hsLabel(row)}` : "추가 · 홈스테이 가정"}
      deleteLabel="삭제하면 되돌릴 수 없습니다. 이 가정에 배정되어 있던 방문자는 '미배정'이 됩니다."
      custom={{
        host: (v, set) => {
          const name = String(v.host || "").trim();
          const d = name ? all.find((h) => h.host.trim() === name && h.id !== row?.id) : undefined;
          return (
            <>
              <Input value={v.host ?? ""} onChange={(e) => set("host", e.target.value)} placeholder="예: 최양업 토마스" />
              {d && <span className="mt-1 block text-[12px] text-warn">⚠ 같은 이름의 가정({hsLabel(d)})이 이미 있습니다. 배정은 가정 번호로 구분되지만 혼동될 수 있으니 세례명·동호수 등을 덧붙이는 것을 권장합니다.</span>}
            </>
          );
        },
        zone: (v, set) => (
          <>
            <Input value={v.zone ?? ""} onChange={(e) => set("zone", e.target.value)} placeholder="예: 2-1구역" />
            {v.zone && <span className="mt-1 block text-[12px] text-ink-3">아파트단지: {zoneApt(v.zone)}</span>}
          </>
        ),
      }} />
  );
}
