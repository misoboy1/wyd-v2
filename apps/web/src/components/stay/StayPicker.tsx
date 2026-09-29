import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Building2, ChevronDown, Home, Unlink, X } from "lucide-react";
import { stayCandidates, type StayCandidate, type StayIndex } from "@wyd/shared";
import { zoneApt } from "@wyd/shared";
import { Checkbox, SearchInput } from "@/components/ui/input";
import { cn, cmp, matchQuery } from "@/lib/utils";
import { dupHosts } from "./stay";

/** 선택 값: "room:<id>" | "hs:<id>" | "" (미배정) | "keep" (연결 끊김 — 현재 값 유지) */
export type StayCode = string;
export const codeOf = (c: Pick<StayCandidate, "kind" | "id">) => c.kind + ":" + c.id;
export function parseStayCode(code: StayCode): { facilityId: number | null; homestayId: number | null } | null {
  const m = /^(room|hs):(\d+)$/.exec(code);
  if (!m) return code === "" ? { facilityId: null, homestayId: null } : null;
  return m[1] === "room" ? { facilityId: Number(m[2]), homestayId: null } : { facilityId: null, homestayId: Number(m[2]) };
}

const tagOf = (c: StayCandidate) => `(${c.avail ? c.gender : c.reason}·${c.used}/${c.cap || "∞"})`;
// 'R1'로 'R01', 'H7'로 'H007'도 찾도록 앞자리 0을 뺀 번호를 검색어에 추가
const loose = (s: string) => s.replace(/\b([RrHh])0+(\d)/g, "$1$2");

/**
 * 방문자 숙소 선택 — 검색 가능한 목록(교리실·홈스테이 구역별 묶음).
 * 성별·숙박 기간이 바뀌면 후보(정원·혼숙·기간)를 즉시 다시 계산. 배정 불가한 곳은 사유와 함께 회색.
 */
export function StayPicker({
  I,
  sex,
  stay,
  selfId,
  value,
  onChange,
  keepLabel,
}: {
  I: StayIndex;
  sex: string;
  stay: string;
  selfId: number | null;
  value: StayCode;
  onChange: (v: StayCode) => void;
  /** 연결 끊김 상태면 옛 값 문구(현재 값 유지 선택지 표시) */
  keepLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [onlyAvail, setOnlyAvail] = useState(true);
  const cands = useMemo(() => stayCandidates(I, sex, selfId, stay), [I, sex, selfId, stay]);
  const dup = useMemo(() => dupHosts([...I.homestayById.values()]), [I]);
  const current = cands.find((c) => codeOf(c) === value);
  const isDup = (c: StayCandidate) => c.kind === "hs" && dup.has(String(I.homestayById.get(c.id)?.host || "").trim());

  const { sections, nShow, nHit } = useMemo(() => {
    const hit = (c: StayCandidate) => matchQuery(q, c.label, loose(c.label), c.search, c.kind === "hs" ? zoneApt(c.zone) : "");
    const shown = (c: StayCandidate) => (onlyAvail ? c.avail && (c.kind !== "room" || !!c.rr) : true);
    const vis = cands.filter((c) => codeOf(c) === value || (shown(c) && hit(c))).sort((a, b) => cmp(a.label, b.label));
    const secs: { title: string; items: StayCandidate[] }[] = [];
    const rooms = vis.filter((c) => c.kind === "room" && c.rr),
      rooms2 = vis.filter((c) => c.kind === "room" && !c.rr);
    if (rooms.length) secs.push({ title: "성당시설 · R교리실", items: rooms });
    if (rooms2.length) secs.push({ title: "성당시설 · 번호 없는 공간 (자동 배정 제외)", items: rooms2 });
    const byZone = new Map<string, StayCandidate[]>();
    vis
      .filter((c) => c.kind === "hs")
      .forEach((c) => {
        const z = c.zone || "구역 미지정";
        byZone.set(z, [...(byZone.get(z) || []), c]);
      });
    [...byZone.keys()].sort(cmp).forEach((z) => secs.push({ title: "홈스테이 · " + z, items: byZone.get(z)! }));
    return { sections: secs, nShow: vis.filter((c) => codeOf(c) !== value).length, nHit: q ? cands.filter(hit).length : cands.length };
  }, [cands, q, onlyAvail, value]);

  const nAvail = cands.filter((c) => c.avail).length;
  const nRoom = cands.filter((c) => c.kind === "room").length;
  const pick = (v: StayCode) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };

  let display: ReactNode;
  if (value === "keep")
    display = (
      <span className="inline-flex items-center gap-1.5 text-bad">
        <Unlink className="size-4" />
        연결 끊김 — 현재 값 유지 ({keepLabel})
      </span>
    );
  else if (current) display = <OptionLabel c={current} dup={isDup(current)} />;
  else if (value) display = <span className="text-ink-3">선택한 숙소를 찾을 수 없습니다</span>;
  else display = <span className="text-ink-3">— 미배정 —</span>;

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="숙소 선택"
          className="flex h-9.5 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 pr-14 text-left text-[14px] text-ink focus:border-primary focus:ring-3 focus:ring-[var(--ring)] focus:outline-none"
        >
          <span className="min-w-0 flex-1 truncate">{display}</span>
        </button>
        {value && value !== "keep" && (
          <button
            type="button"
            aria-label="미배정으로"
            onClick={() => pick("")}
            className="absolute top-1/2 right-8 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
        <ChevronDown
          className={cn(
            "pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-3 transition-transform",
            open && "rotate-180",
          )}
        />
      </div>
      {current && !current.avail && (
        <p className="mt-1 flex items-center gap-1 text-[12px] text-warn">
          <AlertTriangle className="size-3.5" />
          현재 성별·기간 기준으로 배정할 수 없는 곳입니다({current.reason}). 저장하면 거부될 수 있습니다.
        </p>
      )}
      {open && (
        // 폼 필드가 <label>로 감싸져 있어 빈 곳을 누르면 선택 버튼이 눌리는 것 방지
        <div
          className="mt-2 rounded-xl border border-line bg-surface-2/50 p-2"
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("button,input,label")) e.preventDefault();
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="검색: H번호·가정명·구역·아파트·주소·언어 / R번호·교리실명"
              className="min-w-40 flex-1"
            />
            <Checkbox checked={onlyAvail} onChange={setOnlyAvail} label="배정 가능한 곳만" className="text-[12.5px]" />
          </div>
          <p className="mt-1.5 px-1 text-[11.5px] leading-relaxed text-ink-3">
            방문자 성별: <b className="text-ink-2">{sex || "미입력"}</b> · 배정 가능 {nAvail}곳 / 전체 {cands.length}곳(교리실 {nRoom} ·
            홈스테이 {cands.length - nRoom}) · 표시 {nShow}곳{q && ` · '${q}' 검색 일치 ${nHit}곳`}
            {q && !nShow && nHit > 0 && <b className="text-warn"> — '배정 가능한 곳만'을 해제하면 보입니다</b>}
            {q && !nHit && <b className="text-bad"> — 일치하는 곳 없음</b>}. 성별·정원이 맞지 않는 곳은 회색(선택 불가)입니다.
          </p>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface" role="listbox" aria-label="숙소 후보">
            {keepLabel && (
              <Opt on={value === "keep"} onClick={() => pick("keep")}>
                <span className="inline-flex items-center gap-1.5 text-bad">
                  <Unlink className="size-3.5" />⚠ 연결 끊김 — 현재 값 유지 ({keepLabel})
                </span>
              </Opt>
            )}
            <Opt on={value === ""} onClick={() => pick("")}>
              <span className="text-ink-2">— 미배정 —</span>
            </Opt>
            {sections.map((s) => (
              <div key={s.title}>
                <div className="sticky top-0 z-[1] border-y border-line bg-surface-2 px-3 py-1 text-[11.5px] font-semibold text-ink-3">
                  {s.title} <span className="font-normal">{s.items.length}</span>
                </div>
                {s.items.map((c) => {
                  const code = codeOf(c),
                    on = code === value;
                  return (
                    <Opt
                      key={code}
                      on={on}
                      disabled={!c.avail && !on}
                      onClick={() => pick(code)}
                      title={c.avail ? undefined : `배정 불가: ${c.reason}`}
                    >
                      <OptionLabel c={c} dup={isDup(c)} />
                    </Opt>
                  );
                })}
              </div>
            ))}
            {!sections.length && <div className="px-3 py-4 text-center text-[12.5px] text-ink-3">표시할 숙소가 없습니다.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Opt({
  on,
  disabled,
  onClick,
  children,
  title,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "flex w-full items-center px-3 py-1.5 text-left text-[13px] transition-colors",
        on ? "bg-primary-soft text-primary-soft-ink" : "hover:bg-surface-2",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      {children}
    </button>
  );
}

function OptionLabel({ c, dup }: { c: StayCandidate; dup?: boolean }) {
  const Icon = c.kind === "room" ? Building2 : Home;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className={cn("size-3.5 shrink-0", c.kind === "room" ? "text-series-room" : "text-series-hs")} />
      <span className="truncate">{c.label}</span>
      {dup && <span className="text-[11px] text-bad">⚠동명</span>}
      <span className={cn("text-[11.5px] whitespace-nowrap", c.avail ? "text-ink-3" : "text-bad")}>{tagOf(c)}</span>
      {c.kind === "hs" && c.lang && <span className="truncate text-[11px] text-ink-3">· {c.lang}</span>}
    </span>
  );
}
