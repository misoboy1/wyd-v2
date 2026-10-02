// 입력 검증(zod) 메시지 — schemas.ts의 메시지 키와 zod 기본 오류(issueMsg) 번역. 필드명 뒤에 붙는 짧은 꼴
import type { Shape } from "../../core.js";
import type { valid as ko } from "../ko/valid.js";

export const valid = {
  nonNegativeNumber: "must be a number 0 or greater",
  facilityNameRequired: "space name is required",
  hostRequired: "host name is required",
  nameRequired: "name is required",
  questionRequired: "question is required",
  dateFormat: "must be in YYYY-MM-DD format",
  usernameChars: "username may only contain letters, digits and ._@-",
  passwordMin: "password must be at least 8 characters",
  newPasswordMin: "new password must be at least 8 characters",
  required: "required",
  tooShort: "at least {min} characters",
  tooLong: "at most {max} characters",
  min: "must be {min} or more",
  max: "must be {max} or less",
  tooFew: "at least {min} items",
  tooMany: "at most {max} items",
  invalidType: "invalid type",
  invalidOption: "value not allowed",
  invalidFormat: "invalid format",
  invalid: "invalid input",
} satisfies Shape<typeof ko>;
