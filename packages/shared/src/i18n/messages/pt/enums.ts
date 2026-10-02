// DB 저장값(한국어) → 표시 라벨. 저장값 자체는 바꾸지 않는다(G-08). 없는 값은 원문 그대로 표시
import type { Shape } from "../../core.js";
import type { enums as ko } from "../ko/enums.js";

export const enums = {
  sex: { 남: "Masculino", 여: "Feminino", 공용: "Misto", 남녀: "Masc./Fem.", "—": "—" },
  visitorStatus: { 확정: "Confirmado", 변동중: "Em alteração", 대기: "Em espera" },
  facilityStatus: { 가용: "Disponível", 사용중: "Em uso", 점검중: "Em manutenção" },
  homestayStatus: { 제안: "Proposta", 확정: "Confirmada", 입실: "Hospedados", 퇴실: "Saída" },
  deptKind: { 분과: "Seção", 구역: "Zona" },
  placeCat: { 성당: "Igreja", 교통: "Transporte", 대회장: "Local do evento", 의료: "Médico", 편의: "Serviços", 기타: "Outros" },
  volRole: {
    봉사단장: "Chefe de voluntários",
    청년대표: "Representante jovem",
    팀장: "Líder de equipe",
    분과장: "Chefe de seção",
    팀원: "Membro da equipe",
    분과원: "Membro da seção",
  },
  appRole: { admin: "Administrador paroquial", dept: "Responsável de seção", host: "Família anfitriã" },
  reason: {
    숙박불가: "Não é para hospedagem",
    점검중: "Em manutenção",
    정원미입력: "Sem capacidade",
    남전용: "Só homens",
    여전용: "Só mulheres",
    만실: "Lotado",
    이성숙박중: "Hospeda o outro sexo",
    퇴실: "Saída",
    수용미입력: "Sem capacidade",
    남요청: "Pede homens",
    여요청: "Pede mulheres",
    정원참: "Capacidade cheia",
    남정원참: "Vagas masc. cheias",
    여정원참: "Vagas fem. cheias",
    기간불일치: "Datas não coincidem",
  },
} satisfies Shape<typeof ko>;
