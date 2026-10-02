// DB 저장값(한국어) → 표시 라벨. 저장값 자체는 바꾸지 않는다(G-08). 없는 값은 원문 그대로 표시
import type { Shape } from "../../core.js";
import type { enums as ko } from "../ko/enums.js";

export const enums = {
  sex: { 남: "Male", 여: "Female", 공용: "Mixed", 남녀: "Male/Female", "—": "—" },
  visitorStatus: { 확정: "Confirmed", 변동중: "Changing", 대기: "Waiting" },
  facilityStatus: { 가용: "Available", 사용중: "In use", 점검중: "Under maintenance" },
  homestayStatus: { 제안: "Proposed", 확정: "Confirmed", 입실: "Checked in", 퇴실: "Checked out" },
  deptKind: { 분과: "Division", 구역: "District" },
  placeCat: { 성당: "Church", 교통: "Transport", 대회장: "Event venue", 의료: "Medical", 편의: "Amenities", 기타: "Other" },
  volRole: {
    봉사단장: "Volunteer head",
    청년대표: "Youth representative",
    팀장: "Team leader",
    분과장: "Division head",
    팀원: "Team member",
    분과원: "Division member",
  },
  appRole: { admin: "Parish admin", dept: "Division lead", host: "Host family" },
  reason: {
    숙박불가: "Not for lodging",
    점검중: "Under maintenance",
    정원미입력: "No capacity set",
    남전용: "Men only",
    여전용: "Women only",
    만실: "Full",
    이성숙박중: "Other sex staying",
    퇴실: "Checked out",
    수용미입력: "No capacity set",
    남요청: "Men requested",
    여요청: "Women requested",
    정원참: "At capacity",
    남정원참: "Men at capacity",
    여정원참: "Women at capacity",
    기간불일치: "Dates don't match",
  },
} satisfies Shape<typeof ko>;
