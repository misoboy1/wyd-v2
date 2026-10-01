import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enumLabel, fmtWeekday, hasMessage, normSex, resolveLocale, translate, translateDynamic } from "./index.js";

describe("i18n", () => {
  it("resolveLocale: Accept-Language 우선순위·기본값", () => {
    expect(resolveLocale("pt-BR,pt;q=0.9")).toBe("pt");
    expect(resolveLocale("de-DE,fr;q=0.5,en;q=0.8")).toBe("en");
    expect(resolveLocale("de")).toBe("ko");
    expect(resolveLocale(undefined)).toBe("ko");
  });
  it("translate: 보간·복수형·폴백", () => {
    expect(translate("ko", "common.save")).toBe("저장");
    expect(translate("en", "common.people", { n: 1 })).toBe("1 person");
    expect(translate("en", "common.people", { n: 3 })).toBe("3 people");
    expect(translate("ko", "common.people", { n: 1200 })).toBe("1,200명");
    expect(translateDynamic("en", "nope.key")).toBe("nope.key");
  });
  it("enumLabel: 저장값 → 라벨, 모르는 값은 원문", () => {
    expect(enumLabel("en", "visitorStatus", "확정")).toBe("Confirmed");
    expect(enumLabel("fr", "sex", "여")).toBe("Femme");
    expect(enumLabel("en", "visitorStatus", "자유입력")).toBe("자유입력");
  });
  it("fmtWeekday: 0=일요일", () => {
    expect(fmtWeekday("ko", 0)).toBe("일");
    expect(fmtWeekday("en", 1)).toBe("Mon");
  });
  it("normSex: 다국어 성별 라벨도 저장값으로", () => {
    expect(normSex("Femme")).toBe("여");
    expect(normSex("hombre")).toBe("남");
    expect(normSex("Masculino")).toBe("남");
  });
  it("코드에 쓴 err.*/valid.* 리터럴 키가 사전에 모두 있음(tsc가 못 잡는 동적 호출 대비)", () => {
    const root = join(__dirname, "../../..");
    const files: string[] = [];
    const walk = (d: string) =>
      readdirSync(d).forEach((f) => {
        const p = join(d, f);
        if (statSync(p).isDirectory()) return f !== "node_modules" && f !== "dist" && walk(p);
        if (/\.tsx?$/.test(f) && !f.endsWith(".test.ts")) files.push(p);
      });
    ["apps/api/src", "apps/web/src", "packages/shared/src"].forEach((d) => walk(join(root, d)));
    const missing = new Set<string>();
    for (const f of files)
      for (const m of readFileSync(f, "utf8").matchAll(/["'`]((?:err|valid)\.[\w.]+)["'`]/g)) if (!hasMessage(m[1])) missing.add(m[1]);
    expect([...missing]).toEqual([]);
  });
});
