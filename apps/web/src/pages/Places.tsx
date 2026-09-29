// 추천 장소·지도 — 분류 필터, 한/영 병기 카드, 네이버·구글 지도 링크, 본당 기준 길찾기
import { useMemo, useState, type ReactNode } from "react";
import { Lightbulb, MapPin, MapPinned, Navigation, Pencil, Plus } from "lucide-react";
import { PARISH, type Place } from "@wyd/shared";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Empty, PageHeader, Skeleton } from "@/components/ui/misc";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditDialog } from "@/components/form/EditDialog";

// ── 지도 링크(기존 앱과 동일한 주소 규칙) ──
const naverSearchUrl = (p: Place) => "https://m.map.naver.com/search2/search.naver?query=" + encodeURIComponent(p.query || p.name || "");
const googleSearchUrl = (p: Place) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent((p.name || "") + (p.addr ? " " + p.addr : ""));
/** 성당(기준 장소)에서 해당 장소까지 길찾기(구글, 이름 기반) */
const googleDirUrl = (from: string, to: string) => "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(from) + "&destination=" + encodeURIComponent(to);

const PLACE_CATS = ["성당", "교통", "대회장", "의료", "편의", "기타"];
const CAT_TONE: Record<string, Tone> = { 성당: "blue", 교통: "gray", 대회장: "amber", 의료: "red", 편의: "green", 기타: "gray" };
const CAT_EN: Record<string, string> = { 성당: "Church", 교통: "Transit", 대회장: "Venue", 의료: "Medical", 편의: "Convenience", 기타: "Other" };
const catOf = (p: Place) => (PLACE_CATS.includes(p.cat) ? p.cat : "기타");

const MapLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[12.5px] font-medium text-ink shadow-soft transition hover:bg-surface-2 [&_svg]:size-3.5">
    {children}
  </a>
);

function PlaceCard({ p, pin, onEdit }: { p: Place; pin?: Place; onEdit?: () => void }) {
  const cat = catOf(p);
  const isPin = pin?.id === p.id;
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={CAT_TONE[cat]}>{cat} · {CAT_EN[cat]}</Badge>
          {isPin && <Badge tone="blue"><MapPin />본당 · Parish</Badge>}
        </div>
        {onEdit && <Button size="icon-sm" variant="ghost" className="-mt-1 -mr-1" aria-label={`${p.name} 편집`} onClick={onEdit}><Pencil /></Button>}
      </div>
      <h3 className="mt-2 text-[16px] font-semibold text-ink">{p.name}</h3>
      {p.nameEn && <div className="text-[13px] text-ink-3">{p.nameEn}</div>}
      {p.addr && (
        <div className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
          <div>{p.addr}</div>
          {p.addrEn && <div className="text-ink-3">{p.addrEn}</div>}
        </div>
      )}
      {p.desc && <p className="mt-2 text-[13px] whitespace-pre-wrap text-ink">{p.desc}</p>}
      {p.descEn && <p className="mt-0.5 text-[12.5px] whitespace-pre-wrap text-ink-3 italic">{p.descEn}</p>}
      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        <MapLink href={naverSearchUrl(p)}><span className="size-2 rounded-full bg-good" aria-hidden />네이버지도 <span className="text-ink-3">/ Naver</span></MapLink>
        <MapLink href={googleSearchUrl(p)}><MapPinned />구글지도 <span className="text-ink-3">/ Google</span></MapLink>
        {pin && !isPin && <MapLink href={googleDirUrl(pin.name, p.name + (p.addr ? " " + p.addr : ""))}><Navigation />성당→여기 길찾기 <span className="text-ink-3">/ Directions</span></MapLink>}
      </div>
    </article>
  );
}

export default function Places() {
  const { rows, isLoading } = useTable("places");
  const { canWrite } = useCan();
  const editable = canWrite("places");
  const [cat, setCat] = useState<string>("all");
  const [edit, setEdit] = useState<{ row: Place | null } | null>(null);

  const list = useMemo(() => rows.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id), [rows]);
  // 기준 장소(길찾기 출발점): 본당 이름과 같은 장소 → 첫 '성당' → 첫 장소
  const pin = list.find((p) => p.name === PARISH.name) ?? list.find((p) => p.cat === "성당") ?? list[0];
  const byCat = useMemo(() => {
    const m = new Map<string, Place[]>();
    list.forEach((p) => { const c = catOf(p); m.set(c, [...(m.get(c) ?? []), p]); });
    return m;
  }, [list]);
  const cats = PLACE_CATS.filter((c) => byCat.has(c));
  const shown = cat === "all" ? cats : cats.filter((c) => c === cat);
  const maxSort = list.reduce((m, p) => Math.max(m, p.sort ?? 0), 0);
  const defaults = useMemo(() => ({ cat: cat === "all" ? "기타" : cat, sort: maxSort + 1 }), [cat, maxSort]);

  return (
    <div>
      <PageHeader icon={<MapPin />} title={<>추천 장소 · 지도 <span className="text-[15px] font-normal text-ink-3">Recommended Places</span></>}
        subtitle="순례자용 주요 장소 · 네이버지도(영문)/구글지도로 열기 · 본당 기준 길찾기 · 한/영 병기"
        actions={editable && <Button variant="primary" onClick={() => setEdit({ row: null })}><Plus />장소 추가</Button>} />

      <div className="mb-4 flex gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-[13px] leading-relaxed text-ink-2">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" />
        <div>
          <b className="text-ink">네이버지도(영문) / Naver Map (English)</b>는 한국에서 도보·대중교통 길찾기가 가장 정확합니다. 외국인 순례자에게는 네이버지도 앱 설치 후 언어를 English로 바꾸도록 안내하세요.
          <div className="mt-1 text-ink-3 italic">For pilgrims: Naver Map gives the most accurate walking/transit directions in Korea. Install the app and set the language to English. Google Map opens easily without an account.</div>
        </div>
      </div>

      {/* 분류 필터 */}
      <div className="sticky top-14 z-10 -mx-3 mb-4 sm:top-16 flex gap-1.5 overflow-x-auto bg-bg/90 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0" role="tablist" aria-label="분류 필터">
        {[{ k: "all", l: "전체", n: list.length }, ...cats.map((c) => ({ k: c, l: `${c} · ${CAT_EN[c]}`, n: byCat.get(c)!.length }))].map((o) => (
          <button key={o.k} role="tab" aria-selected={cat === o.k} onClick={() => setCat(o.k)}
            className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition",
              cat === o.k ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-2")}>
            {o.l}<span className={cn("tabular text-[11.5px]", cat === o.k ? "opacity-80" : "text-ink-3")}>{o.n}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : !list.length ? (
        <Empty icon={<MapPin />} title="등록된 장소가 없습니다.">{editable && "‘장소 추가’로 순례자 안내용 장소를 등록하세요."}</Empty>
      ) : (
        <div className="space-y-6">
          {shown.map((c) => (
            <section key={c} aria-labelledby={`cat-${c}`}>
              <h2 id={`cat-${c}`} className="mb-2 text-[15px] font-semibold text-ink">{c} <span className="text-[12.5px] font-normal text-ink-3">· {CAT_EN[c]} · {byCat.get(c)!.length}곳</span></h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {byCat.get(c)!.map((p) => <PlaceCard key={p.id} p={p} pin={pin} onEdit={canWrite("places", p) ? () => setEdit({ row: p }) : undefined} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      <EditDialog table="places" open={!!edit} onOpenChange={(o) => !o && setEdit(null)} row={edit?.row ?? null} defaults={defaults}
        title={edit?.row ? `장소 편집 · ${edit.row.name}` : "장소 추가"} deleteLabel="이 장소를 추천 목록에서 삭제합니다." />
    </div>
  );
}
