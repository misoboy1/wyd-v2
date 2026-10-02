// 입력 검증(zod) 메시지 — schemas.ts의 메시지 키와 zod 기본 오류(issueMsg) 번역. 필드명 뒤에 붙는 짧은 꼴
import type { Shape } from "../../core.js";
import type { valid as ko } from "../ko/valid.js";

export const valid = {
  nonNegativeNumber: "debe ser un número igual o mayor que 0",
  facilityNameRequired: "el nombre del espacio es obligatorio",
  hostRequired: "el responsable es obligatorio",
  nameRequired: "el nombre es obligatorio",
  questionRequired: "la pregunta es obligatoria",
  commentRequired: "el comentario es obligatorio",
  dateFormat: "debe tener el formato AAAA-MM-DD",
  usernameChars: "el usuario solo admite letras, números y ._@-",
  passwordMin: "la contraseña debe tener al menos 8 caracteres",
  newPasswordMin: "la nueva contraseña debe tener al menos 8 caracteres",
  required: "obligatorio",
  tooShort: "al menos {min} caracteres",
  tooLong: "como máximo {max} caracteres",
  min: "debe ser {min} o más",
  max: "debe ser {max} o menos",
  tooFew: "al menos {min} elementos",
  tooMany: "como máximo {max} elementos",
  invalidType: "tipo no válido",
  invalidOption: "valor no permitido",
  invalidFormat: "formato no válido",
  invalid: "entrada no válida",
} satisfies Shape<typeof ko>;
