// DB 저장값(한국어) → 표시 라벨. 저장값 자체는 바꾸지 않는다(G-08). 없는 값은 원문 그대로 표시
import type { Shape } from "../../core.js";
import type { enums as ko } from "../ko/enums.js";

export const enums = {
  sex: { 남: "Hombre", 여: "Mujer", 공용: "Mixto", 남녀: "Hombre/Mujer", "—": "—" },
  visitorStatus: { 확정: "Confirmado", 변동중: "En cambio", 대기: "En espera" },
  facilityStatus: { 가용: "Disponible", 사용중: "En uso", 점검중: "En mantenimiento" },
  homestayStatus: { 제안: "Propuesta", 확정: "Confirmada", 입실: "Alojados", 퇴실: "Salida" },
  deptKind: { 분과: "Sección", 구역: "Zona" },
  placeCat: { 성당: "Iglesia", 교통: "Transporte", 대회장: "Sede del evento", 의료: "Médico", 편의: "Servicios", 기타: "Otros" },
  volRole: {
    봉사단장: "Jefe de voluntarios",
    청년대표: "Representante juvenil",
    팀장: "Líder de equipo",
    분과장: "Jefe de sección",
    팀원: "Miembro del equipo",
    분과원: "Miembro de sección",
  },
  appRole: { admin: "Administrador parroquial", dept: "Responsable de sección", host: "Familia anfitriona" },
  reason: {
    숙박불가: "No apto para alojamiento",
    점검중: "En mantenimiento",
    정원미입력: "Sin capacidad",
    남전용: "Solo hombres",
    여전용: "Solo mujeres",
    만실: "Completo",
    이성숙박중: "Aloja al otro sexo",
    퇴실: "Salida",
    수용미입력: "Sin capacidad",
    남요청: "Solicita hombres",
    여요청: "Solicita mujeres",
    정원참: "Capacidad completa",
    남정원참: "Cupo de hombres completo",
    여정원참: "Cupo de mujeres completo",
    기간불일치: "Fechas no coinciden",
  },
} satisfies Shape<typeof ko>;
