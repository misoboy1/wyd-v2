import { useCallback, useMemo } from "react";
import { COUNTRY_LANG, COUNTRY_OPTS, isOrphan, type Visitor } from "@wyd/shared";
import { EditDialog } from "@/components/form/EditDialog";
import { Input } from "@/components/ui/input";
import { StayPicker, parseStayCode, type StayCode } from "./StayPicker";
import { orphanText } from "./stay";
import { useStayIndex } from "./useStayIndex";

type Values = Record<string, any>;
const NEW_VISITOR: Values = { status: "확정", sex: "" };

/**
 * 방문자 추가·편집 창 — SCHEMA.visitors + 숙소 선택(StayPicker).
 * 저장 시 선택값을 facilityId/homestayId(다른 쪽은 null)로 바꾸고, 새 숙소를 고르면 연결 끊김 값(orphanStay)을 비움.
 */
export function VisitorEditDialog({ open, onOpenChange, row }: { open: boolean; onOpenChange: (v: boolean) => void; row: Visitor | null }) {
  const { I, visitors } = useStayIndex();
  const orphan = !!row && isOrphan(row, I);
  const initial: StayCode = !row ? "" : orphan ? "keep" : row.facilityId != null ? "room:" + row.facilityId : row.homestayId != null ? "hs:" + row.homestayId : "";
  const keepLabel = orphan && row ? orphanText(row, I) || "현재 값" : null;
  const usedCountries = useMemo(() => [...new Set(visitors.map((v) => v.country).filter((c) => c && !COUNTRY_OPTS.includes(c)))], [visitors]);

  const transform = useCallback((v: Values): Values => {
    const { __stay, stayplace: _sp, ...rest } = v;
    const code: StayCode = __stay ?? initial;
    if (code === "keep") return rest; // 다른 항목만 고칠 때 연결 끊김 값 보존
    const ids = parseStayCode(code) ?? { facilityId: null, homestayId: null };
    const changed = code !== initial;
    return { ...rest, ...ids, ...(changed || !row ? { orphanStay: "" } : {}) };
  }, [initial, row]);

  return (
    <EditDialog table="visitors" open={open} onOpenChange={onOpenChange} row={row} defaults={NEW_VISITOR}
      title={row ? `편집 · 방문자(순례자) 개인${row.pid ? " " + row.pid : ""}` : "추가 · 방문자(순례자) 개인"}
      deleteLabel="이 방문자를 명단에서 삭제합니다. 되돌릴 수 없습니다."
      transform={transform}
      custom={{
        stayplace: (v, set) => (
          <StayPicker I={I} sex={v.sex || ""} stay={v.stay || ""} selfId={row?.id ?? null}
            value={v.__stay ?? initial} onChange={(c) => set("__stay", c)} keepLabel={keepLabel} />
        ),
        // 국가를 고르면 언어 칸이 비어 있을 때 대표 언어 자동 입력(기존 pickSync)
        country: (v, set) => (
          <>
            <Input list="dl-vis-country" value={v.country ?? ""} placeholder="목록에서 선택하거나 직접 입력"
              onChange={(e) => { const c = e.target.value; set("country", c); const L = (COUNTRY_LANG as Record<string, string>)[c]; if (L && !String(v.lang || "").trim()) set("lang", L); }} />
            <datalist id="dl-vis-country">{[...COUNTRY_OPTS, ...usedCountries].map((o) => <option key={o} value={o} />)}</datalist>
          </>
        ),
      }} />
  );
}
