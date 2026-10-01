// 추천 장소·지도 — 분류 필터, 언어별(영문 필드 우선) 카드, 네이버·구글 지도 링크, 본당 기준 길찾기
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
import { useT } from "@/lib/i18n";

// ── 지도 링크(기존 앱과 동일한 주소 규칙) ──
const naverSearchUrl = (p: Place) => "https://m.map.naver.com/search2/search.naver?query=" + encodeURIComponent(p.query || p.name || "");
const googleSearchUrl = (p: Place) =>
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent((p.name || "") + (p.addr ? " " + p.addr : ""));
/** 성당(기준 장소)에서 해당 장소까지 길찾기(구글, 이름 기반) */
const googleDirUrl = (from: string, to: string) =>
  "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(from) + "&destination=" + encodeURIComponent(to);

const PLACE_CATS = ["성당", "교통", "대회장", "의료", "편의", "기타"];
const CAT_TONE: Record<string, Tone> = { 성당: "blue", 교통: "gray", 대회장: "amber", 의료: "red", 편의: "green", 기타: "gray" };
const catOf = (p: Place) => (PLACE_CATS.includes(p.cat) ? p.cat : "기타");

const MapLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[12.5px] font-medium text-ink shadow-soft transition hover:bg-surface-2 [&_svg]:size-3.5"
  >
    {children}
  </a>
);

function PlaceCard({ p, pin, onEdit }: { p: Place; pin?: Place; onEdit?: () => void }) {
  const { t, label, locale } = useT();
  const cat = catOf(p);
  const isPin = pin?.id === p.id;
  // 한국어 외 언어는 영문 필드 우선(비어 있으면 한국어), 다른 쪽은 보조 표기
  const en = locale !== "ko";
  const pick = (ko?: string | null, eng?: string | null) => {
    const main = (en && eng?.trim() ? eng : ko) || eng || "";
    const sub = main === ko ? eng : ko;
    return { main, sub: sub && sub !== main ? sub : "" };
  };
  const name = pick(p.name, p.nameEn);
  const addr = pick(p.addr, p.addrEn);
  const desc = pick(p.desc, p.descEn);
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={CAT_TONE[cat]}>{label("placeCat", cat)}</Badge>
          {isPin && (
            <Badge tone="blue">
              <MapPin />
              {t("board.places.parish")}
            </Badge>
          )}
        </div>
        {onEdit && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="-mt-1 -mr-1"
            aria-label={t("board.editAria", { name: name.main })}
            onClick={onEdit}
          >
            <Pencil />
          </Button>
        )}
      </div>
      <h3 className="mt-2 text-[16px] font-semibold text-ink">{name.main}</h3>
      {name.sub && <div className="text-[13px] text-ink-3">{name.sub}</div>}
      {addr.main && (
        <div className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
          <div>{addr.main}</div>
          {addr.sub && <div className="text-ink-3">{addr.sub}</div>}
        </div>
      )}
      {desc.main && <p className="mt-2 text-[13px] whitespace-pre-wrap text-ink">{desc.main}</p>}
      {desc.sub && <p className="mt-0.5 text-[12.5px] whitespace-pre-wrap text-ink-3 italic">{desc.sub}</p>}
      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        <MapLink href={naverSearchUrl(p)}>
          <span className="size-2 rounded-full bg-good" aria-hidden />
          {t("board.places.naver")}
        </MapLink>
        <MapLink href={googleSearchUrl(p)}>
          <MapPinned />
          {t("board.places.google")}
        </MapLink>
        {pin && !isPin && (
          <MapLink href={googleDirUrl(pin.name, p.name + (p.addr ? " " + p.addr : ""))}>
            <Navigation />
            {t("board.places.directions")}
          </MapLink>
        )}
      </div>
    </article>
  );
}

export default function Places() {
  const { t, label } = useT();
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
    list.forEach((p) => {
      const c = catOf(p);
      m.set(c, [...(m.get(c) ?? []), p]);
    });
    return m;
  }, [list]);
  const cats = PLACE_CATS.filter((c) => byCat.has(c));
  const shown = cat === "all" ? cats : cats.filter((c) => c === cat);
  const maxSort = list.reduce((m, p) => Math.max(m, p.sort ?? 0), 0);
  const defaults = useMemo(() => ({ cat: cat === "all" ? "기타" : cat, sort: maxSort + 1 }), [cat, maxSort]);

  return (
    <div>
      <PageHeader
        icon={<MapPin />}
        title={t("board.places.title")}
        subtitle={t("board.places.subtitle")}
        actions={
          editable && (
            <Button variant="primary" onClick={() => setEdit({ row: null })}>
              <Plus />
              {t("board.places.add")}
            </Button>
          )
        }
      />

      <div className="mb-4 flex gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-[13px] leading-relaxed text-ink-2">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" />
        <div>
          <b className="text-ink">{t("board.places.tipTitle")}</b>
          {t("board.places.tipBody")}
        </div>
      </div>

      {/* 분류 필터 */}
      <div
        className="sticky top-14 z-10 -mx-3 mb-4 sm:top-16 flex gap-1.5 overflow-x-auto bg-bg/90 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0"
        role="tablist"
        aria-label={t("board.places.catFilter")}
      >
        {[
          { k: "all", l: t("common.all"), n: list.length },
          ...cats.map((c) => ({ k: c, l: label("placeCat", c), n: byCat.get(c)!.length })),
        ].map((o) => (
          <button
            key={o.k}
            role="tab"
            aria-selected={cat === o.k}
            onClick={() => setCat(o.k)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition",
              cat === o.k ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {o.l}
            <span className={cn("tabular text-[11.5px]", cat === o.k ? "opacity-80" : "text-ink-3")}>{o.n}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : !list.length ? (
        <Empty icon={<MapPin />} title={t("board.places.empty")}>
          {editable && t("board.places.emptyHint")}
        </Empty>
      ) : (
        <div className="space-y-6">
          {shown.map((c) => (
            <section key={c} aria-labelledby={`cat-${c}`}>
              <h2 id={`cat-${c}`} className="mb-2 text-[15px] font-semibold text-ink">
                {label("placeCat", c)}{" "}
                <span className="text-[12.5px] font-normal text-ink-3">· {t("board.places.count", { n: byCat.get(c)!.length })}</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {byCat.get(c)!.map((p) => (
                  <PlaceCard key={p.id} p={p} pin={pin} onEdit={canWrite("places", p) ? () => setEdit({ row: p }) : undefined} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EditDialog
        table="places"
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        row={edit?.row ?? null}
        defaults={defaults}
        title={edit?.row ? t("board.places.editTitle", { name: edit.row.name }) : t("board.places.add")}
        deleteLabel={t("board.places.deleteLabel")}
      />
    </div>
  );
}
