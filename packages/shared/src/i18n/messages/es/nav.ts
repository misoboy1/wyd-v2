// 메뉴(내비게이션) 라벨 — apps/web/src/lib/nav.ts
import type { Shape } from "../../core.js";
import type { nav as ko } from "../ko/nav.js";

export const nav = {
  group: {
    ops: "Operación",
    stay: "Alojamiento · Peregrinos",
    vol: "Voluntarios",
    comm: "Comunicación",
    prayer: "Oración",
    admin: "Administración",
  },
  dash: "Panel",
  prep: "Preparación Día D",
  schedule: "Agenda",
  visitors: "Peregrinos",
  facilities: "Instalaciones",
  homestays: "Familias anfitrionas",
  org: "Organigrama",
  volunteers: "Voluntarios",
  notices: "Avisos",
  posts: "Tablón",
  qna: "Preguntas de peregrinos",
  places: "Lugares y mapa",
  gori: "Cadena de oración",
  users: "Cuentas",
} satisfies Shape<typeof ko>;
