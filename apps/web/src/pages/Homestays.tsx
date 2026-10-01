import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardPaste,
  Download,
  FileDown,
  Home,
  Pencil,
  Plus,
  Printer,
  X,
  Zap,
} from "lucide-react";
import { hsCaps, PARISH, reqSex, SCALE, zoneApt, type Homestay, type MsgKey, type StayIndex, type Visitor } from "@wyd/shared";
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
import { cmp, cn, matchQuery } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useStayIndex } from "@/components/stay/useStayIndex";
import { GuestList } from "@/components/stay/GuestList";
import { VisitorEditDialog } from "@/components/stay/VisitorEditDialog";
import { AutoAssignDialog } from "@/components/stay/AutoAssignDialog";
import { PrintPicker } from "@/components/stay/PrintPicker";
import { TeamRoster } from "@/components/stay/TeamRoster";
import { Dash, FamBadges, HsStatus, Pager, ReqSexBadge, SortHead, Tel, usePage, type SortState } from "@/components/stay/bits";
import { applyCols, dupHosts, famLabel, homestayCols, hsFill, hsLabel, sexSummary, type HsFill, type Tr } from "@/components/stay/stay";

type SortKey = "hid" | "zone" | "zoneApt" | "host" | "addr" | "tel" | "family" | "lang" | "period" | "cap" | "reqSex" | "status" | "note";
const NUMERIC = ["mAdult", "fAdult", "mStu", "fStu", "mYng", "fYng", "cap"];
const pasteDef = ({ t }: Tr): PasteDef => ({
  label: t("stay.hs.pasteLabel"),
  table: "homestays",
  cols: [
    ["host", t("stay.hs.pasteHost")],
    ["zone", t("stay.col.zone")],
    ["addr", t("stay.col.addr")],
    ["tel", t("stay.col.tel")],
    ["mAdult", t("stay.fam.mAdult")],
    ["fAdult", t("stay.fam.fAdult")],
    ["mStu", t("stay.fam.mStu")],
    ["fStu", t("stay.fam.fStu")],
    ["mYng", t("stay.fam.mYng")],
    ["fYng", t("stay.fam.fYng")],
    ["lang", t("stay.col.lang")],
    ["cap", t("stay.col.cap")],
    ["period", t("stay.col.period")],
    ["status", t("stay.col.status")],
    ["note", t("stay.col.note")],
  ],
  // 숫자 칸: "2명" 같은 표기도 숫자만 남김
  mapRow: (o) => {
    const r: Record<string, any> = { ...o };
    NUMERIC.forEach((k) => {
      if (r[k] != null) {
        const d = String(r[k]).replace(/[^\d.]/g, "");
        r[k] = d === "" ? null : Number(d);
      }
    });
    return r;
  },
});
/** 구역 필터의 '구역 없음' 값(주소 저장용 내부 값 — 화면에는 번역해 표시) */
const NO_ZONE = "미지정";
const NEW_HS = { status: "제안" };

function sortVal(h: Homestay, k: SortKey, tr: Tr): unknown {
  if (k === "cap") return hsCaps(h).cap;
  if (k === "zoneApt") return zoneApt(h.zone);
  if (k === "reqSex") return reqSex(h);
  if (k === "family") return famLabel(h, false, tr);
  return (h as any)[k];
}

export default function Homestays() {
  const tr = useT();
  const { t, num } = tr;
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
  const setParam = useCallback(
    (k: string, v: string) =>
      setSp(
        (p) => {
          const n = new URLSearchParams(p);
          if (v && v !== "all") n.set(k, v);
          else n.delete(k);
          return n;
        },
        { replace: true },
      ),
    [setSp],
  );

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
    const tm = setTimeout(() => document.querySelector(".hs-focus-row")?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
    return () => clearTimeout(tm);
  }, [focus?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- 포커스 가정이 바뀔 때만 펼침·스크롤(의도)

  const dup = useMemo(() => dupHosts(homestays), [homestays]);
  const kindCnt = useMemo(() => {
    const c = { none: 0, free: 0, full: 0, over: 0 };
    homestays.forEach((h) => c[hsFill(h, I)]++);
    return c;
  }, [homestays, I]);
  const zones = useMemo(() => {
    const c = new Map<string, number>();
    homestays.forEach((h) => {
      const z = h.zone || NO_ZONE;
      c.set(z, (c.get(z) || 0) + 1);
    });
    return [...c].sort((a, b) => cmp(a[0], b[0]));
  }, [homestays]);
  const kpi = useMemo(() => {
    const cap = homestays.filter((h) => h.status !== "퇴실").reduce((s, h) => s + hsCaps(h).cap, 0);
    return { cap, left: Math.max(0, cap - I.inHs) };
  }, [homestays, I]);

  const sorted = useMemo(() => {
    const list = focus
      ? [focus]
      : homestays.filter(
          (h) =>
            (fill === "all" || hsFill(h, I) === fill) &&
            (!zone || (h.zone || NO_ZONE) === zone) &&
            matchQuery(dq, h.hid, h.host, h.zone, zoneApt(h.zone), h.addr, h.tel, h.lang, h.period, h.match, h.status, h.note),
        );
    return list.slice().sort((a, b) => {
      const x = sortVal(a, sort.key, tr),
        y = sortVal(b, sort.key, tr);
      return (typeof x === "number" && typeof y === "number" ? x - y : cmp(x, y)) * sort.dir;
    });
  }, [homestays, I, focus, fill, zone, dq, sort, tr]);
  const pg = usePage(sorted.length, page, size);
  const pageRows = sorted.slice(pg.start, pg.end);
  const pageAllOpen = pageRows.length > 0 && pageRows.every((h) => open.has(h.id));
  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const cols = useMemo(() => homestayCols(I, tr), [I, tr]);
  const paste = useMemo(() => pasteDef(tr), [tr]);
  const printKey = useCallback((h: Homestay, by: string) => (by === "zone" ? h.zone : zoneApt(h.zone)) || t("stay.ui.unset"), [t]);
  const byHid = useMemo(() => homestays.slice().sort((a, b) => cmp(a.hid, b.hid)), [homestays]);
  const clearFocus = () =>
    setSp(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete("focus");
        n.delete("from");
        return n;
      },
      { replace: true },
    );

  const columns = useMemo<Column<Homestay>[]>(() => {
    const H = (k: SortKey, l: MsgKey) => <SortHead k={k} label={t(l)} sort={sort} onSort={setSort} />;
    const c: Column<Homestay>[] = [
      {
        key: "hid",
        header: H("hid", "stay.col.pid"),
        cell: (h) => <span className="font-semibold whitespace-nowrap">{h.hid || "—"}</span>,
      },
      { key: "zone", header: H("zone", "stay.col.zone"), cell: (h) => (h.zone ? <Badge>{h.zone}</Badge> : <Dash />) },
      {
        key: "zoneApt",
        header: H("zoneApt", "stay.col.zoneApt"),
        className: "min-w-28 text-[12.5px] text-ink-3",
        cell: (h) => zoneApt(h.zone),
        hideOnMobile: true,
      },
      {
        key: "host",
        header: H("host", "stay.col.host"),
        cell: (h) => (
          <span className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap">
            {h.host}
            {dup.has(String(h.host || "").trim()) && (
              <Badge tone="red" title={t("stay.hs.dupBadgeTitle")}>
                {t("stay.hs.dupBadge")}
              </Badge>
            )}
          </span>
        ),
      },
      { key: "addr", header: H("addr", "stay.col.addr"), className: "min-w-40", cell: (h) => h.addr || <Dash />, hideOnMobile: true },
      { key: "tel", header: H("tel", "stay.col.tel"), cell: (h) => <Tel tel={h.tel} /> },
      {
        key: "family",
        header: H("family", "stay.col.family"),
        cell: (h) => (
          <>
            <span className="max-md:hidden">
              <FamBadges h={h} />
            </span>
            <span className="text-[12.5px] whitespace-nowrap md:hidden">{famLabel(h, true, tr)}</span>
          </>
        ),
      },
      { key: "lang", header: H("lang", "stay.col.lang"), cell: (h) => <span className="whitespace-nowrap">{h.lang || "—"}</span> },
      {
        key: "period",
        header: H("period", "stay.col.period"),
        cell: (h) => <span className="whitespace-nowrap">{h.period || "—"}</span>,
        hideOnMobile: true,
      },
      {
        key: "cap",
        header: H("cap", "stay.col.cap"),
        cell: (h) => <span className="tabular whitespace-nowrap">{hsCaps(h).cap ? t("common.people", { n: hsCaps(h).cap }) : "—"}</span>,
      },
      { key: "reqSex", header: H("reqSex", "stay.col.reqSex"), cell: (h) => <ReqSexBadge h={h} /> },
      { key: "status", header: H("status", "stay.col.status"), cell: (h) => <HsStatus s={h.status} /> },
      {
        key: "note",
        header: H("note", "stay.col.note"),
        className: "min-w-28 max-w-60 text-ink-3",
        cell: (h) => (
          <span className="line-clamp-2 whitespace-pre-wrap" title={h.note}>
            {h.note || "—"}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: "guests",
        header: t("stay.col.guests"),
        cell: (h) => <GuestsCell h={h} I={I} open={open.has(h.id)} onToggle={() => toggle(h.id)} />,
      },
    ];
    if (editable)
      c.push({
        key: "edit",
        header: <span className="sr-only">{t("stay.ui.manage")}</span>,
        cell: (h) => (
          <Button size="sm" variant="ghost" onClick={() => setEdit({ row: h })}>
            <Pencil />
            {t("stay.ui.edit")}
          </Button>
        ),
      });
    return c;
  }, [sort, dup, I, open, editable, t, tr]);

  if (isLoading)
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-56" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );

  const focusGuests = focus ? I.byHomestay.get(focus.id)?.length || 0 : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Home />}
        title={isHost ? t("stay.hs.titleHost") : t("stay.hs.title")}
        subtitle={isHost ? t("stay.hs.subtitleHost") : t("stay.hs.subtitle", { total: homestays.length, max: SCALE.homestays })}
        actions={
          <>
            {fromVisitors && (
              <Button variant="ghost" onClick={() => navigate(-1)}>
                <ChevronLeft />
                {t("stay.hs.backToVisitors")}
              </Button>
            )}
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
                    `${PARISH.name}_${t("stay.hs.file")}`,
                    cols.map((c) => c[0]),
                    applyCols(cols, byHid),
                  )
                }
              >
                {t("stay.ui.csvDownload")}
              </MenuItem>
              <MenuSep />
              <MenuItem
                icon={<Printer />}
                onSelect={() =>
                  printDocument(
                    t("stay.hs.printTitle", { parish: PARISH.name }),
                    [{ columns: cols.map((c) => c[0]), rows: applyCols(cols, byHid) }],
                    {
                      kpis: [
                        [t("stay.hs.kpiHomes"), num(homestays.length)],
                        [t("stay.hs.kpiCap"), t("common.people", { n: kpi.cap })],
                        [t("stay.hs.kpiAssigned"), t("common.people", { n: I.inHs })],
                      ],
                    },
                  )
                }
              >
                {t("stay.ui.printAll")}
              </MenuItem>
              {!isHost && (
                <MenuItem icon={<Printer />} onSelect={() => setPrintOpen(true)}>
                  {t("stay.hs.printGroups")}
                </MenuItem>
              )}
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

      <TeamRoster icon="🏠" title={t("stay.hs.teamTitle")} desc={t("stay.hs.teamDesc")} teamName="홈스테이팀" keywords={["홈스테이"]} />

      {!isHost && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat
            label={t("stay.hs.statHomes")}
            value={
              <>
                {num(homestays.length)}
                <span className="text-[13px] font-medium text-ink-3"> / {num(SCALE.homestays)}</span>
              </>
            }
            onClick={() => setParam("fill", "all")}
          />
          <Stat label={t("stay.hs.statCap")} value={t("common.people", { n: kpi.cap })} />
          <Stat label={t("stay.hs.statAssigned")} value={t("common.people", { n: I.inHs })} tone="good" />
          <Stat label={t("stay.hs.statLeft")} value={t("common.people", { n: kpi.left })} />
          <Stat
            label={t("stay.hs.statNone")}
            value={num(kindCnt.none)}
            tone={kindCnt.none ? "warn" : undefined}
            onClick={() => setParam("fill", "none")}
            className="max-lg:col-span-2 max-sm:col-span-1"
          />
        </div>
      )}

      {dup.size > 0 && !isHost && (
        <div className="flex gap-2.5 rounded-2xl border border-bad/30 bg-bad-soft/60 p-3.5 text-[13.5px] text-ink-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" />
          <div>
            <b className="text-bad">{t("stay.hs.dupTitle", { n: dup.size })}</b>
            {t("stay.hs.dupBody")}
          </div>
        </div>
      )}

      {!isHost && (
        <Card className="space-y-2.5 p-3 lg:sticky lg:top-[4.5rem] lg:z-10">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={q} onChange={(v) => setParam("q", v)} placeholder={t("stay.hs.search")} className="min-w-56 flex-1" />
            <Select aria-label={t("stay.col.zone")} value={zone} onChange={(e) => setParam("zone", e.target.value)} className="w-44">
              <option value="">{t("stay.ui.zoneAll", { count: zones.length })}</option>
              {zones.map(([z, n]) => (
                <option key={z} value={z}>
                  {z === NO_ZONE ? t("stay.ui.unset") : z} ({n})
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[12.5px] text-ink-3">{t("stay.hs.filterFill")}</span>
            <Segmented
              value={fill}
              onChange={(v) => setParam("fill", v)}
              options={[
                { value: "all", label: t("common.all"), count: homestays.length },
                { value: "none", label: t("stay.hs.fillNone"), count: kindCnt.none },
                { value: "free", label: t("stay.hs.fillFree"), count: kindCnt.free },
                { value: "full", label: t("stay.hs.fillFull"), count: kindCnt.full },
                ...(kindCnt.over || fill === "over" ? [{ value: "over" as const, label: t("stay.hs.fillOver"), count: kindCnt.over }] : []),
              ]}
            />
          </div>
        </Card>
      )}

      {focus && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/40 bg-primary-soft/60 px-4 py-3 text-[13.5px]">
          <span>
            🏠 <b className="text-ink">{hsLabel(focus)}</b> {t("stay.hs.focusA", { n: focusGuests, cap: hsCaps(focus).cap || "—" })}
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="secondary" onClick={clearFocus}>
            <X />
            {t("stay.hs.showAll")}
          </Button>
          {fromVisitors && (
            <Button size="sm" variant="primary" onClick={() => navigate(-1)}>
              <ChevronLeft />
              {t("stay.hs.backToVisitors")}
            </Button>
          )}
        </div>
      )}
      {focusId != null && !focus && homestays.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
          {t("stay.hs.focusMissing", { id: String(focusId) })}{" "}
          <Button size="sm" variant="ghost" onClick={clearFocus}>
            {t("stay.hs.showAll")}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-[12.5px] text-ink-3">{t("stay.hs.expandHint")}</span>
        {pageRows.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setOpen((s) => {
                const n = new Set(s);
                pageRows.forEach((h) => (pageAllOpen ? n.delete(h.id) : n.add(h.id)));
                return n;
              })
            }
          >
            {pageAllOpen ? (
              <>
                <ChevronUp />
                {t("stay.hs.collapsePage")}
              </>
            ) : (
              <>
                <ChevronDown />
                {t("stay.hs.expandPage")}
              </>
            )}
          </Button>
        )}
      </div>
      {!focus && <Pager total={sorted.length} unit="homes" page={pg.p} size={size} onPage={setPage} onSize={setSize} />}

      <Card className="overflow-hidden">
        <DataTable
          rows={pageRows}
          columns={columns}
          rowKey={(h) => h.id}
          dense
          isExpanded={(h) => open.has(h.id)}
          rowClassName={(h) =>
            cn(focus?.id === h.id ? "hs-focus-row [&>td]:bg-primary-soft/70" : open.has(h.id) && "[&>td]:bg-primary-soft/30")
          }
          renderExpanded={(h) => (
            <GuestList
              title={hsLabel(h)}
              list={I.byHomestay.get(h.id) || []}
              cap={hsCaps(h).cap}
              emptyMsg={t("stay.hs.guestEmpty")}
              onGo={isHost ? undefined : () => navigate(`/visitors?hs=${h.id}`)}
              onEdit={setVisEdit}
            />
          )}
          empty={
            homestays.length ? (
              <Empty title={t("stay.hs.noMatch")}>{t("stay.ui.noMatchHint")}</Empty>
            ) : (
              <Empty icon={<Home />} title={isHost ? t("stay.hs.emptyHost") : t("stay.hs.empty")}>
                {isHost ? t("stay.hs.emptyHostHint") : editable ? t("stay.hs.emptyHint") : null}
              </Empty>
            )
          }
        />
      </Card>
      {!focus && pg.pages > 1 && <Pager total={sorted.length} unit="homes" page={pg.p} size={size} onPage={setPage} onSize={setSize} />}

      {!isHost && <p className="px-1 text-[12px] leading-relaxed text-ink-3">{t("stay.hs.footnote")}</p>}

      {editable && <HomestayEditDialog row={edit?.row ?? null} open={!!edit} onOpenChange={(o) => !o && setEdit(null)} all={homestays} />}
      <VisitorEditDialog open={!!visEdit} onOpenChange={(o) => !o && setVisEdit(null)} row={visEdit} />
      {isAdmin && <AutoAssignDialog open={aaOpen} onOpenChange={setAaOpen} />}
      {editable && <PasteImport def={paste} open={pasteOpen} onOpenChange={setPasteOpen} />}
      {!isHost && (
        <PrintPicker
          open={printOpen}
          onOpenChange={setPrintOpen}
          label={t("stay.hs.printLabel")}
          unit="homes"
          groupers={[
            ["zone", t("stay.col.zone")],
            ["zoneApt", t("stay.hs.groupApt")],
          ]}
          keyOf={printKey}
          rows={sorted}
          cols={cols}
        />
      )}
    </div>
  );
}

/** 숙박자 칸: 펼치기 버튼 + 성별 구성·배정/수용(초과 빨강) */
function GuestsCell({ h, I, open, onToggle }: { h: Homestay; I: StayIndex; open: boolean; onToggle: () => void }) {
  const tr = useT();
  const { t } = tr;
  const ps = I.byHomestay.get(h.id) || [];
  const cap = hsCaps(h).cap,
    n = ps.length,
    over = cap > 0 && n > cap;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
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
      {n ? (
        <span className={cn("text-[12px] tabular", over ? "font-semibold text-bad" : "text-ink-3")}>
          {sexSummary(ps, tr)} · {n}/{cap || "—"}
          {over && t("stay.hs.overSuffix")}
        </span>
      ) : cap ? (
        <span className="text-[12px] text-ink-3 tabular">0/{cap}</span>
      ) : null}
    </div>
  );
}

/** 가정 추가·편집 — 같은 대표자명이 있으면 경고(500가정 규모 동명 혼동 방지) */
function HomestayEditDialog({
  row,
  open,
  onOpenChange,
  all,
}: {
  row: Homestay | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  all: Homestay[];
}) {
  const { t } = useT();
  return (
    <EditDialog
      table="homestays"
      open={open}
      onOpenChange={onOpenChange}
      row={row}
      defaults={NEW_HS}
      title={row ? t("stay.hs.editTitle", { label: hsLabel(row) }) : t("stay.hs.addTitle")}
      deleteLabel={t("stay.hs.deleteLabel")}
      custom={{
        host: (v, set) => {
          const name = String(v.host || "").trim();
          const d = name ? all.find((h) => h.host.trim() === name && h.id !== row?.id) : undefined;
          return (
            <>
              <Input value={v.host ?? ""} onChange={(e) => set("host", e.target.value)} placeholder={t("stay.hs.hostPh")} />
              {d && <span className="mt-1 block text-[12px] text-warn">{t("stay.hs.dupWarn", { label: hsLabel(d) })}</span>}
            </>
          );
        },
        zone: (v, set) => (
          <>
            <Input value={v.zone ?? ""} onChange={(e) => set("zone", e.target.value)} placeholder={t("stay.hs.zonePh")} />
            {v.zone && <span className="mt-1 block text-[12px] text-ink-3">{t("stay.hs.aptLine", { apt: zoneApt(v.zone) })}</span>}
          </>
        ),
      }}
    />
  );
}
