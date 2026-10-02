// 메뉴(내비게이션) 라벨 — apps/web/src/lib/nav.ts
import type { Shape } from "../../core.js";
import type { nav as ko } from "../ko/nav.js";

export const nav = {
  group: {
    ops: "Opérations",
    stay: "Hébergement · Pèlerins",
    vol: "Bénévoles",
    comm: "Communication",
    prayer: "Prière",
    admin: "Administration",
  },
  dash: "Tableau de bord",
  prep: "Préparation Jour J",
  schedule: "Programme",
  visitors: "Pèlerins",
  facilities: "Locaux",
  homestays: "Familles d'accueil",
  org: "Organigramme",
  volunteers: "Bénévoles",
  notices: "Annonces",
  posts: "Forum",
  qna: "Questions des pèlerins",
  places: "Lieux et carte",
  gori: "Chaîne de prière",
  users: "Comptes",
} satisfies Shape<typeof ko>;
