// 입력 검증(zod) 메시지 — schemas.ts의 메시지 키와 zod 기본 오류(issueMsg) 번역. 필드명 뒤에 붙는 짧은 꼴
import type { Shape } from "../../core.js";
import type { valid as ko } from "../ko/valid.js";

export const valid = {
  nonNegativeNumber: "doit être un nombre supérieur ou égal à 0",
  facilityNameRequired: "le nom de l'espace est obligatoire",
  hostRequired: "le responsable est obligatoire",
  nameRequired: "le nom est obligatoire",
  questionRequired: "la question est obligatoire",
  dateFormat: "doit être au format AAAA-MM-JJ",
  usernameChars: "l'identifiant n'accepte que lettres, chiffres et ._@-",
  passwordMin: "le mot de passe doit contenir au moins 8 caractères",
  newPasswordMin: "le nouveau mot de passe doit contenir au moins 8 caractères",
  required: "obligatoire",
  tooShort: "au moins {min} caractères",
  tooLong: "au plus {max} caractères",
  min: "doit être supérieur ou égal à {min}",
  max: "doit être inférieur ou égal à {max}",
  tooFew: "au moins {min} éléments",
  tooMany: "au plus {max} éléments",
  invalidType: "type non valide",
  invalidOption: "valeur non autorisée",
  invalidFormat: "format non valide",
  invalid: "saisie non valide",
} satisfies Shape<typeof ko>;
