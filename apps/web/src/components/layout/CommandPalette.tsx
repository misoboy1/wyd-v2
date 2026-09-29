import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { Home, Search, User, HandHeart } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { useTable } from "@/lib/data";
import { useAuth } from "@/lib/auth";

/** ⌘K — 메뉴 이동 + 방문자(P번호·이름)·홈스테이(H번호·대표자)·봉사자 검색 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const { rows: visitors } = useTable("visitors");
  const { rows: homestays } = useTable("homestays");
  const { rows: vols } = useTable("volunteers");
  const go = (to: string) => { onOpenChange(false); setQ(""); nav(to); };
  const term = q.trim().toLowerCase();
  const people = useMemo(() => term.length < 1 ? [] : visitors.filter((v) => `${v.pid} ${v.name} ${v.gno} ${v.country}`.toLowerCase().includes(term)).slice(0, 8), [visitors, term]);
  const hosts = useMemo(() => term.length < 1 ? [] : homestays.filter((h) => `${h.hid} ${h.host} ${h.zone}`.toLowerCase().includes(term)).slice(0, 6), [homestays, term]);
  const staff = useMemo(() => term.length < 1 ? [] : vols.filter((v) => `${v.name} ${v.team}`.toLowerCase().includes(term)).slice(0, 6), [vols, term]);
  const item = "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-ink aria-selected:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3";
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <D.Content className="fixed top-[12vh] left-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-none">
          <D.Title className="sr-only">검색</D.Title><D.Description className="sr-only">메뉴와 명단 검색</D.Description>
          <Command shouldFilter={false} label="검색">
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4.5 text-ink-3" />
              <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="메뉴, 방문자 이름·P번호, 가정 H번호…" className="h-13 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-[13.5px] text-ink-3">검색 결과가 없습니다.</Command.Empty>
              <Command.Group heading="메뉴" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-ink-3">
                {NAV_ITEMS.filter((i) => (!i.roles || (user && i.roles.includes(user.role))) && (!term || (i.label + i.en).toLowerCase().includes(term))).map((i) => (
                  <Command.Item key={i.path} value={"nav:" + i.path} onSelect={() => go(i.path)} className={item}><i.icon />{i.label}<span className="ml-auto text-[12px] text-ink-3">{i.en}</span></Command.Item>
                ))}
              </Command.Group>
              {!!people.length && <Command.Group heading="방문자" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-ink-3">
                {people.map((v) => <Command.Item key={v.id} value={"v:" + v.id} onSelect={() => go(`/visitors?q=${encodeURIComponent(v.pid)}`)} className={item}><User /><span className="tabular text-ink-3">{v.pid}</span>{v.name}<span className="ml-auto text-[12px] text-ink-3">{v.gno} · {v.country}</span></Command.Item>)}
              </Command.Group>}
              {!!hosts.length && <Command.Group heading="홈스테이 가정" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-ink-3">
                {hosts.map((h) => <Command.Item key={h.id} value={"h:" + h.id} onSelect={() => go(`/homestays?focus=${h.id}`)} className={item}><Home /><span className="tabular text-ink-3">{h.hid}</span>{h.host}<span className="ml-auto text-[12px] text-ink-3">{h.zone}</span></Command.Item>)}
              </Command.Group>}
              {!!staff.length && <Command.Group heading="봉사자" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-ink-3">
                {staff.map((v) => <Command.Item key={v.id} value={"s:" + v.id} onSelect={() => go(`/volunteers?q=${encodeURIComponent(v.name)}`)} className={item}><HandHeart />{v.name}<span className="ml-auto text-[12px] text-ink-3">{v.team}</span></Command.Item>)}
              </Command.Group>}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
