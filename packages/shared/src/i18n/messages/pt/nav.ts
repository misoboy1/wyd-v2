// 메뉴(내비게이션) 라벨 — apps/web/src/lib/nav.ts
import type { Shape } from "../../core.js";
import type { nav as ko } from "../ko/nav.js";

export const nav = {
  group: {
    ops: "Operação",
    stay: "Hospedagem · Peregrinos",
    vol: "Voluntários",
    comm: "Comunicação",
    prayer: "Oração",
    admin: "Administração",
  },
  dash: "Painel",
  prep: "Preparação Dia D",
  schedule: "Agenda",
  visitors: "Peregrinos",
  facilities: "Instalações",
  homestays: "Famílias anfitriãs",
  org: "Organograma",
  volunteers: "Voluntários",
  notices: "Avisos",
  posts: "Mural",
  qna: "Perguntas dos peregrinos",
  places: "Lugares e mapa",
  gori: "Corrente de oração",
  users: "Contas",
} satisfies Shape<typeof ko>;
