import { describe, it, expect } from "vitest";
import { roomFit, hsFit, planAutoAssign, buildStayIndex, AA_DEFAULT, csvCell, parsePeriod } from "./index.js";
import type { Facility, Homestay, Visitor } from "./index.js";

const F = (o: Partial<Facility>): Facility => ({
  id: 1,
  version: 1,
  rno: "R01",
  name: "절제",
  type: "숙박 교리실",
  area: "",
  cap: 7,
  ac: "O",
  outlet: "",
  wheel: "",
  gender: "남",
  status: "가용",
  note: "",
  ...o,
});
const H = (o: Partial<Homestay>): Homestay => ({
  id: 1,
  version: 1,
  hid: "H001",
  host: "가정",
  zone: "",
  addr: "",
  tel: "",
  mAdult: 0,
  fAdult: 0,
  fStu: 0,
  mStu: 0,
  fYng: 0,
  mYng: 0,
  lang: "영어",
  cap: 2,
  period: "",
  match: "",
  status: "확정",
  note: "",
  ...o,
});
let n = 0;
const V = (o: Partial<Visitor>): Visitor => ({
  id: ++n,
  version: 1,
  pid: "P" + n,
  gno: "",
  name: "v" + n,
  sex: "남",
  tel: "",
  country: "",
  lang: "영어",
  facilityId: null,
  homestayId: null,
  orphanStay: "",
  stay: "8/2–8/9",
  role: "",
  status: "확정",
  note: "",
  ...o,
});

describe("roomFit (기존 index.html 동작과 동일)", () => {
  it("점검중/정원미입력/성별/만실", () => {
    expect(roomFit(F({ status: "점검중" }), "남", []).reason).toBe("점검중");
    expect(roomFit(F({ cap: 0 }), "남", []).reason).toBe("정원미입력");
    expect(roomFit(F({ gender: "남" }), "여", []).reason).toBe("남전용");
    expect(roomFit(F({ cap: 1 }), "남", [{ sex: "남" }]).reason).toBe("만실");
    expect(roomFit(F({}), "남", []).avail).toBe(true);
  });
  it("v2: 공용실 이성 혼숙 차단", () => {
    expect(roomFit(F({ gender: "공용" }), "여", [{ sex: "남" }]).reason).toBe("이성숙박중");
  });
});

describe("hsFit", () => {
  it("요청 성별·성별 정원·혼숙·기간", () => {
    expect(hsFit(H({ mYng: 2 }), "여", []).reason).toBe("남요청");
    expect(hsFit(H({ mYng: 1, fYng: 1 }), "남", [{ sex: "남" }]).reason).toBe("남정원참");
    expect(hsFit(H({ cap: 3 }), "여", [{ sex: "남" }]).reason).toBe("이성숙박중");
    expect(hsFit(H({ mYng: 2, period: "8/2–8/5" }), "남", [], "8/2–8/9").reason).toBe("기간불일치");
    expect(hsFit(H({ status: "퇴실", mYng: 2 }), "남", []).reason).toBe("퇴실");
  });
  it("parsePeriod", () => {
    expect(parsePeriod("7월 29일~8월 9일")).toEqual([729, 809]);
    expect(parsePeriod("2027-08-02~2027-08-09")).toEqual([802, 809]);
  });
});

describe("planAutoAssign", () => {
  it("그룹 단위로 같은 방, 정원·성별 준수, 부족분은 unplaced", () => {
    const facs = [F({ id: 1, cap: 3, gender: "남" }), F({ id: 2, rno: "R02", name: "선행", cap: 2, gender: "여" })];
    const hss = [H({ id: 1, mYng: 2, cap: 2 })];
    const vis = [
      V({ gno: "G1" }),
      V({ gno: "G1" }),
      V({ gno: "G1" }),
      V({ gno: "G2", sex: "여" }),
      V({ gno: "G2", sex: "여" }),
      V({ gno: "G2", sex: "여" }),
      V({ gno: "G3" }),
    ];
    const P = planAutoAssign(vis, facs, hss, AA_DEFAULT);
    const byTarget = (k: string, id: number) => P.plan.filter((p) => p.kind === k && p.targetId === id).length;
    expect(byTarget("room", 1)).toBe(3);
    expect(byTarget("room", 2)).toBe(2);
    expect(P.unplaced.map((v) => v.sex)).toEqual(["여"]);
    expect(byTarget("hs", 1)).toBe(1);
    const all = vis.map((v) => {
      const p = P.plan.find((x) => x.visitorId === v.id);
      return p ? { ...v, facilityId: p.kind === "room" ? p.targetId : null, homestayId: p.kind === "hs" ? p.targetId : null } : v;
    });
    const I = buildStayIndex(all, facs, hss);
    expect(I.byFacility.get(1).every((v) => v.sex === "남")).toBe(true);
  });
});

describe("csvCell", () => {
  it("수식 방지", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("-5")).toBe("-5");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
});
