import { buildStayIndex, type Facility, type Homestay, type StayIndex, type Visitor } from "@wyd/shared";
import { useTable } from "@/lib/data";

// 세 표가 그대로면 이전 인덱스 재사용 — 페이지·편집 창·목록이 같은 인덱스를 공유(방문자 1,000명·가정 500곳도 1회 계산)
let last: { v: Visitor[]; f: Facility[]; h: Homestay[]; I: StayIndex } | null = null;
export function stayIndexOf(v: Visitor[], f: Facility[], h: Homestay[]): StayIndex {
  if (last && last.v === v && last.f === f && last.h === h) return last.I;
  const I = buildStayIndex(v, f, h);
  last = { v, f, h, I };
  return I;
}

/** 방문자·시설·가정 + 점유 인덱스 */
export function useStayIndex() {
  const v = useTable("visitors"), f = useTable("facilities"), h = useTable("homestays");
  const I = stayIndexOf(v.rows, f.rows, h.rows);
  return { I, visitors: v.rows, facilities: f.rows, homestays: h.rows, isLoading: v.isLoading || f.isLoading || h.isLoading };
}
