import { ChevronRight, Pencil } from "lucide-react";
import type { Visitor } from "@wyd/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCan } from "@/lib/auth";
import { cmp } from "@/lib/utils";
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
  goLabel = "방문자 명단에서 보기 ›",
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
  const { canWrite } = useCan();
  const editable = !!onEdit && canWrite("visitors");
  const rows = list.slice().sort((a, b) => cmp(a.pid, b.pid));
  const m = rows.filter((p) => p.sex === "남").length,
    w = rows.filter((p) => p.sex === "여").length;
  const groups = [...new Set(rows.map((p) => p.gno).filter(Boolean))];
  const langs = [...new Set(rows.map((p) => p.lang).filter(Boolean))];
  const c = Number(cap) || 0;
  const heads = ["번호", "그룹", "이름", "성별", "국가", "언어", "기간", "역할", "상태", "연락처", "비고"];

  return (
    <div className="px-3 py-3 sm:px-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <b className="text-ink">{title}</b>
        <span className="text-ink-2">
          숙박 방문자 {rows.length}명{c ? ` / 수용 ${c}명` : ""}
        </span>
        {c > 0 && rows.length > c && <Badge tone="red">초과</Badge>}
        {rows.length > 0 && (
          <span className="text-ink-3">
            · 남 {m} · 여 {w}
            {groups.length ? " · 그룹 " + groups.join(", ") : ""}
            {langs.length ? " · " + langs.join("/") : ""}
          </span>
        )}
        <span className="flex-1" />
        {onGo && (
          <Button size="sm" variant="ghost" onClick={onGo}>
            {goLabel.replace(/\s*›$/, "")}
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
                    <span className="sr-only">관리</span>
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
                        편집
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
          {emptyMsg || "배정된 방문자가 없습니다."}
          {editable && " 방문자 명단에서 숙소를 지정하거나 ⚡ 자동 배정을 사용하세요."}
        </p>
      )}
    </div>
  );
}
