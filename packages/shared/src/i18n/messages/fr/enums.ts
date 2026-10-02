// DB 저장값(한국어) → 표시 라벨. 저장값 자체는 바꾸지 않는다(G-08). 없는 값은 원문 그대로 표시
import type { Shape } from "../../core.js";
import type { enums as ko } from "../ko/enums.js";

export const enums = {
  sex: { 남: "Homme", 여: "Femme", 공용: "Mixte", 남녀: "Homme/Femme", "—": "—" },
  visitorStatus: { 확정: "Confirmé", 변동중: "En changement", 대기: "En attente" },
  facilityStatus: { 가용: "Disponible", 사용중: "Occupé", 점검중: "En maintenance" },
  homestayStatus: { 제안: "Proposée", 확정: "Confirmée", 입실: "Arrivés", 퇴실: "Partis" },
  deptKind: { 분과: "Section", 구역: "Secteur" },
  placeCat: { 성당: "Église", 교통: "Transport", 대회장: "Lieu de l'événement", 의료: "Médical", 편의: "Services", 기타: "Autre" },
  volRole: {
    봉사단장: "Chef des bénévoles",
    청년대표: "Représentant des jeunes",
    팀장: "Chef d'équipe",
    분과장: "Chef de section",
    팀원: "Membre d'équipe",
    분과원: "Membre de section",
  },
  appRole: { admin: "Administrateur paroissial", dept: "Responsable de section", host: "Famille d'accueil" },
  reason: {
    숙박불가: "Pas d'hébergement",
    점검중: "En maintenance",
    정원미입력: "Capacité non saisie",
    남전용: "Hommes uniquement",
    여전용: "Femmes uniquement",
    만실: "Complet",
    이성숙박중: "Autre sexe hébergé",
    퇴실: "Partis",
    수용미입력: "Capacité non saisie",
    남요청: "Hommes demandés",
    여요청: "Femmes demandées",
    정원참: "Capacité atteinte",
    남정원참: "Places hommes pleines",
    여정원참: "Places femmes pleines",
    기간불일치: "Dates incompatibles",
  },
} satisfies Shape<typeof ko>;
