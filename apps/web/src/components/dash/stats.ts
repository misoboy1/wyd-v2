// 대시보드 공통 집계 — 기존 totals() 이식(대시보드·각 화면 수치 일치)
import { hsCaps, isSleepRoom, type Facility, type Homestay, type StayIndex, type Visitor } from "@wyd/shared";
import { stayIndexOf } from "@/components/stay/useStayIndex";

export interface Totals {
  I: StayIndex;
  total: number;
  cap: number;
  roomCap: number;
  hsCap: number;
  inRoom: number;
  inHs: number;
  unassigned: number;
  orphan: number;
  over: boolean;
  roomOver: boolean;
  hsCount: number;
  rooms: number;
  unmatched: number;
}

export function totals(visitors: Visitor[], facilities: Facility[], homestays: Homestay[]): Totals {
  const I = stayIndexOf(visitors, facilities, homestays); // 화면들과 같은 인덱스 공유(중복 계산 방지)
  // 전체 수용 = 숙박 교리실(점검중 제외) + 홈스테이(퇴실 제외) — 방문자 1,000명은 교리실만으로 수용 불가하므로 합산 기준
  const rooms = facilities.filter((f) => isSleepRoom(f) && f.status !== "점검중");
  const roomCap = rooms.reduce((s, f) => s + (Number(f.cap) || 0), 0);
  const H = homestays.filter((h) => h.status !== "퇴실");
  const hsCap = H.reduce((s, h) => s + hsCaps(h).cap, 0);
  const cap = roomCap + hsCap,
    total = visitors.length;
  const unmatched = H.filter((h) => !(I.byHomestay.get(h.id) ?? []).length && (!h.match || h.match === "—")).length;
  return {
    I,
    total,
    cap,
    roomCap,
    hsCap,
    inRoom: I.inRoom,
    inHs: I.inHs,
    unassigned: I.unassigned,
    orphan: I.orphan,
    over: cap > 0 && total > cap,
    roomOver: I.inRoom > roomCap,
    hsCount: homestays.length,
    rooms: rooms.length,
    unmatched,
  };
}
