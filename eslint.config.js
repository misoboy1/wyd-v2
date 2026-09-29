// ESLint (flat config) — 규칙 ID는 CONVENTIONS.md와 연결. 포맷은 Prettier 담당(eslint-config-prettier로 충돌 규칙 끔)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "apps/api/drizzle/**", "**/*.config.{js,ts}", ".data/**", "backups/**"] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ["packages/shared/src/*.test.ts"] }, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // 비동기 저장·요청 누락 방지 (G-05)
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "@typescript-eslint/consistent-type-imports": ["warn", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
      // 외부 데이터(JSON·DB 행)를 다루는 코드가 많아 any 계열은 경고로만
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": "warn",
    },
  },

  // 자동 추출 콘텐츠(기존 index.html 원문) — 타입 검사 제외 파일이므로 린트도 최소화
  {
    files: ["packages/shared/src/content.ts"],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "no-useless-escape": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },

  // 테스트·스크립트(.mjs) — 타입 정보 없이 기본 규칙만
  {
    files: ["**/*.mjs", "**/*.js"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: { ...globals.node }, parserOptions: { projectService: false, project: null } },
    rules: { ...tseslint.configs.disableTypeChecked.rules, "no-console": "off" },
  },
  { files: ["scripts/load/**"], languageOptions: { globals: { __ENV: "readonly" } } },

  // ── WEB ─────────────────────────────────────────────────────────
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "[WEB-03] dangerouslySetInnerHTML 금지(XSS). React로 렌더링하세요.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "[WEB-02] className에 hex 색상 금지 — 디자인 토큰(bg-surface, text-ink…) 사용.",
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "[WEB-02] className에 hex 색상 금지 — 디자인 토큰 사용.",
        },
        {
          selector: "CallExpression[callee.name='fetch']",
          message: "[WEB-01] fetch 직접 호출 금지 — src/lib/api.ts(api.get/post…)를 사용.",
        },
        { selector: "MemberExpression[property.name='innerHTML']", message: "[WEB-03] innerHTML 사용 금지(XSS)." },
      ],
    },
  },
  { files: ["apps/web/src/lib/api.ts"], rules: { "no-restricted-syntax": "off" } },

  // ── API ─────────────────────────────────────────────────────────
  {
    files: ["apps/api/src/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TemplateElement[value.raw=/truncate[\\s\\S]*cascade/i]",
          message: "[API-06] TRUNCATE … CASCADE 금지 — users(FK)까지 지워집니다. 의존 순서대로 DELETE.",
        },
        { selector: "Literal[value=/truncate[\\s\\S]*cascade/i]", message: "[API-06] TRUNCATE … CASCADE 금지." },
      ],
      "no-restricted-properties": [
        "warn",
        {
          object: "sql",
          property: "raw",
          message:
            "[SEC-04] sql.raw는 값 바인딩이 없습니다 — 사용자 입력이 들어가지 않는지 확인하고 사유 주석과 함께 eslint-disable-next-line.",
        },
      ],
      // Nest 데코레이터 클래스는 빈 클래스가 흔함
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
  { files: ["apps/api/src/cli/**", "apps/api/src/main.ts", "apps/api/src/db/migrate.ts"], rules: { "no-console": "off" } },

  prettier,
);
