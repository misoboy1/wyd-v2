// 입력 검증(zod) 메시지 — schemas.ts의 메시지 키와 zod 기본 오류(issueMsg) 번역. 필드명 뒤에 붙는 짧은 꼴
import type { Shape } from "../../core.js";
import type { valid as ko } from "../ko/valid.js";

export const valid = {
  nonNegativeNumber: "deve ser um número igual ou maior que 0",
  facilityNameRequired: "o nome do espaço é obrigatório",
  hostRequired: "o responsável é obrigatório",
  nameRequired: "o nome é obrigatório",
  questionRequired: "a pergunta é obrigatória",
  commentRequired: "o comentário é obrigatório",
  dateFormat: "deve estar no formato AAAA-MM-DD",
  usernameChars: "o usuário só aceita letras, números e ._@-",
  passwordMin: "a senha deve ter pelo menos 8 caracteres",
  newPasswordMin: "a nova senha deve ter pelo menos 8 caracteres",
  required: "obrigatório",
  tooShort: "pelo menos {min} caracteres",
  tooLong: "no máximo {max} caracteres",
  min: "deve ser {min} ou mais",
  max: "deve ser {max} ou menos",
  tooFew: "pelo menos {min} itens",
  tooMany: "no máximo {max} itens",
  invalidType: "tipo inválido",
  invalidOption: "valor não permitido",
  invalidFormat: "formato inválido",
  invalid: "entrada inválida",
} satisfies Shape<typeof ko>;
