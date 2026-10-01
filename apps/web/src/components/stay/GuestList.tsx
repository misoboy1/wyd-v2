import { ChevronRight, Pencil } from "lucide-react";
import type { Visitor } from "@wyd/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCan } from "@/lib/auth";
import { cmp } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { MsgKey } from "@wyd/shared";
import { Dash, SexTag, Tel, VisStatus } from "./bits";

/**
 * 교리실·가정 행 밑에 펼쳐지는 숙박 방문자 명단(방문자 명단과 같은 데이터·같은 편집 창) — 기존 guestListRow.
 * 성당시설·홈스테이 공용
 */
export function GuestList({
  title,
  list,
  cap,
  emptyMsg,
  goLabel,
  onGo,
  onEdit,
}: {
  title: string;
  list: Visitor[];
  cap?: number | null;
  emptyMsg?: string;
  goLabel?: string;
  onGo?: () => void;
  onEdit?: (v: Visitor) => void;
}) {
  const { t } = useT();
  const { canWrite } = useCan();
  const editable = !!onEdit && canWrite("visitors");
  const rows = list.slice().sort((a, b) => cmp(a.pid, b.pid));
  const m = rows.filter((p) => p.sex === "남").length,
    w = rows.filter((p) => p.sex === "여").length;
  const groups = [...new Set(rows.map((p) => p.gno).filter(Boolean))];
  const langs = [...new Set(rows.map((p) => p.lang).filter(Boolean))];
  const c = Number(cap) || 0;
  const heads = HEADS.map((k) => t(k));

  return (
    <div className="px-3 py-3 sm:px-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <b className="text-ink">{title}</b>
        <span className="text-ink-2">
          {t("stay.guest.summary", { n: rows.length })}
          {c ? t("stay.guest.capPart", { cap: c }) : ""}
        </span>
        {c > 0 && rows.length > c && <Badge tone="red">{t("stay.ui.over")}</Badge>}
        {rows.length > 0 && (
          <span className="text-ink-3">
            {t("stay.guest.mf", { m, w })}
            {groups.length ? t("stay.guest.groups", { list: groups.join(", ") }) : ""}
            {langs.length ? " · " + langs.join("/") : ""}
          </span>
        )}
        <span className="flex-1" />
        {onGo && (
          <Button size="sm" variant="ghost" onClick={onGo}>
            {(goLabel ?? t("stay.guest.go")).replace(/\s*›$/, "")}
            <ChevronRight />
          </Button>
        )}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-2 text-ink-3">
              <tr>
                {heads.map((h) => (
                  <th key={h} scope="col" className="px-2.5 py-1.5 text-left font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
                {editable && (
                  <th className="px-2.5 py-1.5">
                    <span className="sr-only">{t("stay.ui.manage")}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap">{p.pid || "—"}</td>
                  <td className="px-2.5 py-1.5">{p.gno ? <Badge tone="blue">{p.gno}</Badge> : <Dash />}</td>
                  <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap">{p.name}</td>
                  <td className="px-2.5 py-1.5">
                    <SexTag sex={p.sex} />
                  </td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">{p.country || <Dash />}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">{p.lang || <Dash />}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">{p.stay || <Dash />}</td>
                  <td className="px-2.5 py-1.5">{p.role ? <Badge tone="green">{p.role}</Badge> : <Dash />}</td>
                  <td className="px-2.5 py-1.5">
                    <VisStatus s={p.status} />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <Tel tel={p.tel} />
                  </td>
                  <td className="min-w-24 px-2.5 py-1.5 whitespace-pre-wrap text-ink-3">{p.note || "—"}</td>
                  {editable && (
                    <td className="px-2.5 py-1.5 text-right">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(p)}>
                        <Pencil />
                        {t("stay.ui.edit")}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line bg-surface px-3 py-3 text-[13px] text-ink-3">
          {emptyMsg || t("stay.guest.empty")}
          {editable && t("stay.guest.emptyHint")}
        </p>
      )}
    </div>
  );
}
const HEADS: MsgKey[] = [
  "stay.col.pid",
  "stay.col.gno",
  "stay.col.name",
  "stay.col.sex",
  "stay.col.country",
  "stay.col.lang",
  "stay.col.period",
  "stay.col.role",
  "stay.col.status",
  "stay.col.tel",
  "stay.col.note",
];
