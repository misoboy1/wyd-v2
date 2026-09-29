// 숙소 배정 서버 검사 — 트랜잭션 안에서 대상 시설/가정 행을 FOR UPDATE로 잠근 뒤 공용 규칙으로 재검사.
// 전역 잠금(기존 LockService) 대신 숙소 단위 잠금이라 서로 다른 숙소 배정은 병렬 처리된다.
import { and, eq, ne, sql } from "drizzle-orm";
import { roomFit, hsFit, isSleepRoom, type Facility, type Homestay } from "@wyd/shared";
import { facilities, homestays, visitors } from "../db/schema.js";
import type { Tx } from "../db/client.js";
import { StayError, Capacity, Invalid } from "../common/errors.js";

type V = { id?: number; sex: string; stay: string; facilityId: number | null; homestayId: number | null; pid?: string; name?: string };

export async function lockFacility(tx: Tx, id: number) {
  const [f] = await tx.select().from(facilities).where(eq(facilities.id, id)).for("update");
  return f as unknown as Facility | undefined;
}
export async function lockHomestay(tx: Tx, id: number) {
  const [h] = await tx.select().from(homestays).where(eq(homestays.id, id)).for("update");
  return h as unknown as Homestay | undefined;
}
async function guestsOf(tx: Tx, col: "facilityId" | "homestayId", id: number, selfId?: number) {
  const c = col === "facilityId" ? visitors.facilityId : visitors.homestayId;
  const cond = selfId ? and(eq(c, id), ne(visitors.id, selfId)) : eq(c, id);
  return tx.select({ id: visitors.id, sex: visitors.sex, stay: visitors.stay }).from(visitors).where(cond);
}

/** 방문자 저장 전 검사. before=null이면 신규. 새로 들어가는 숙소(또는 성별·기간이 바뀐 배정)만 검사 */
export async function checkVisitorStay(tx: Tx, before: V | null, after: V): Promise<void> {
  if (after.facilityId != null && after.homestayId != null) throw Invalid("교리실과 홈스테이를 동시에 배정할 수 없습니다.");
  const moved = !before || before.facilityId !== after.facilityId || before.homestayId !== after.homestayId;
  const changedPerson = !!before && (before.sex !== after.sex || (before.stay || "") !== (after.stay || ""));
  if (!moved && !changedPerson) return;
  const who = after.pid || after.name || "방문자";
  if (after.facilityId != null) {
    const f = await lockFacility(tx, after.facilityId);
    if (!f) throw StayError(`${who}: 배정하려는 교리실이 없습니다(삭제됨).`);
    const guests = await guestsOf(tx, "facilityId", f.id, after.id);
    const r = roomFit(f, after.sex, guests);
    if (!r.avail) throw StayError(`${who}: '${f.name}' 배정 불가 — ${r.reason} (${r.used}/${r.cap})`, { reason: r.reason });
  }
  if (after.homestayId != null) {
    const h = await lockHomestay(tx, after.homestayId);
    if (!h) throw StayError(`${who}: 배정하려는 홈스테이 가정이 없습니다(삭제됨).`);
    const guests = await guestsOf(tx, "homestayId", h.id, after.id);
    const r = hsFit(h, after.sex, guests, after.stay);
    if (!r.avail) throw StayError(`${who}: '${h.hid} ${h.host}' 배정 불가 — ${r.reason} (${r.used}/${r.cap})`, { reason: r.reason });
  }
}

/** 시설·가정 수정 시 현재 숙박자가 계속 규칙에 맞는지(정원 축소·성별 변경·점검중/퇴실 전환 차단). 행은 이미 FOR UPDATE로 잠긴 상태 */
export async function checkHostPolicy(tx: Tx, table: "facilities" | "homestays", after: Record<string, unknown> & { id: number }) {
  const col = table === "facilities" ? "facilityId" : "homestayId";
  const guests = await guestsOf(tx, col, after.id);
  if (!guests.length) return;
  const seated: { sex: string }[] = [];
  for (const g of guests) {
    const r =
      table === "facilities"
        ? roomFit(after as unknown as Facility, g.sex, seated)
        : hsFit(after as unknown as Homestay, g.sex, seated, g.stay);
    if (!r.avail) {
      const why =
        r.reason === "점검중" || r.reason === "퇴실"
          ? `숙박자 ${guests.length}명이 있어 '${r.reason}'(으)로 바꿀 수 없습니다. 먼저 배정을 옮기세요.`
          : r.reason === "숙박불가"
            ? `숙박자 ${guests.length}명이 있어 숙박 시설이 아닌 유형으로 바꿀 수 없습니다.`
            : `현재 숙박자 ${guests.length}명과 맞지 않습니다(${r.reason}). 먼저 배정을 조정하세요.`;
      throw Capacity(why);
    }
    seated.push(g);
  }
}

export { isSleepRoom, sql };
