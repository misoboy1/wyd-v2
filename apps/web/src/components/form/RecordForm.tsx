import { useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { hasMessage, SCHEMA, TEAM_NAMES, type EnumGroup } from "@wyd/shared";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useTable } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export interface FieldDef {
  k: string;
  label: string;
  type: string;
  opts?: string[];
  half?: boolean;
  from?: string;
}
type Values = Record<string, any>;

/** 기존 SCHEMA(index.html) 필드 정의 → 폼. key 필드 이름 변환(dept→deptId) 포함 */
export function schemaFields(table: keyof typeof SCHEMA): FieldDef[] {
  return ((SCHEMA as any)[table]?.fields ?? []) as FieldDef[];
}

type TD = ReturnType<typeof useT>["td"];
/** 저장 키 → 사전 키(폼 필드 이름 일부는 다름. 표 제목 키 "title"과 겹치는 필드는 titleField) */
const FIELD_ALIAS: Record<string, string> = { title: "titleField", deptId: "dept", facilityId: "stayplace", homestayId: "stayplace" };

/**
 * 필드 라벨 번역(shell.fields.<표>.<키>). given이 SCHEMA 원문과 다르면(화면에서 바꾼 라벨) 그대로 쓴다.
 * 사전에 없으면 given → SCHEMA 원문 → 키 순으로 폴백
 */
export function fieldLabel(td: TD, table: string | undefined, k: string, given?: string): string {
  const schemaLabel: string | undefined = table ? (SCHEMA as any)[table]?.fields?.find((f: FieldDef) => f.k === k)?.label : undefined;
  if (given != null && schemaLabel != null && given !== schemaLabel) return given;
  const key = `shell.fields.${table}.${FIELD_ALIAS[k] ?? k}`;
  if (table && hasMessage(key)) return td(key);
  return given ?? schemaLabel ?? k;
}
/** 표 제목(SCHEMA[table].title) 번역 */
export function tableTitle(td: TD, table: string): string {
  const key = `shell.fields.${table}.title`;
  return hasMessage(key) ? td(key) : ((SCHEMA as any)[table]?.title ?? table);
}
/** select 선택지(DB 저장값) → 표시 라벨 그룹 */
function enumGroupOf(k: string, opts: string[] = []): EnumGroup | undefined {
  if (k === "sex" || k === "gender") return "sex";
  if (k === "kind") return "deptKind";
  if (k === "cat") return "placeCat";
  if (k === "role") return "volRole";
  if (k === "status") return opts.includes("가용") ? "facilityStatus" : opts.includes("제안") ? "homestayStatus" : "visitorStatus";
  return undefined;
}

/** 선택 + 직접 입력(목록에 없으면 기타 입력) */
function PickInput({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
  const { t } = useT();
  const id = useMemo(() => "dl-" + Math.random().toString(36).slice(2, 8), []);
  return (
    <>
      <Input list={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={t("shell.form.pickPlaceholder")} />
      <datalist id={id}>
        {opts.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
/** 여러 개 선택(슬래시로 저장: "영어/스페인어") */
function PicksInput({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
  const list = String(value || "")
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const [extra, setExtra] = useState("");
  const { t } = useT();
  const set = (l: string[]) => onChange([...new Set(l)].join("/"));
  return (
    <div className="rounded-lg border border-line-strong bg-surface p-2">
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o) => {
          const on = list.includes(o);
          return (
            <button
              type="button"
              key={o}
              onClick={() => set(on ? list.filter((x) => x !== o) : [...list, o])}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[12.5px]",
                on ? "border-primary bg-primary-soft font-medium text-primary-soft-ink" : "border-line text-ink-2 hover:bg-surface-2",
              )}
            >
              {o}
            </button>
          );
        })}
        {list
          .filter((x) => !opts.includes(x))
          .map((x) => (
            <span
              key={x}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary-soft px-2.5 py-1 text-[12.5px] text-primary-soft-ink"
            >
              {x}
              <button type="button" aria-label={t("shell.form.removeItem", { x })} onClick={() => set(list.filter((y) => y !== x))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
      </div>
      <Input
        className="mt-2 h-8 text-[13px]"
        value={extra}
        placeholder={t("shell.form.picksExtra")}
        onChange={(e) => setExtra(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (extra.trim()) {
              set([...list, extra.trim()]);
              setExtra("");
            }
          }
        }}
      />
    </div>
  );
}

/**
 * 스키마 기반 폼. custom[k]로 특정 필드 렌더링을 바꿀 수 있음(예: 방문자 숙소 선택).
 * errors: 필드별 오류 메시지
 */
export function RecordForm({
  table,
  fields,
  values,
  onChange,
  custom,
  errors,
  className,
}: {
  /** 라벨 번역용 표 이름(없으면 f.label 그대로) */
  table?: string;
  fields: FieldDef[];
  values: Values;
  onChange: (k: string, v: any) => void;
  custom?: Record<string, (v: Values, set: (k: string, v: any) => void) => ReactNode>;
  errors?: Record<string, string>;
  className?: string;
}) {
  const { rows: depts } = useTable("departments");
  const { t, td, label } = useT();
  return (
    <div className={cn("grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2", className)}>
      {fields.map((f) => {
        const wide =
          !f.half &&
          (f.type === "textarea" ||
            f.type === "picks" ||
            f.type === "stayplace" ||
            !["text", "number", "select", "pick", "team", "dept"].includes(f.type) ||
            fields.length < 4);
        const span = f.half ? "" : wide ? "sm:col-span-2" : "";
        const val = values[f.k];
        const set = (v: any) => onChange(f.k, v);
        let input: ReactNode;
        if (custom?.[f.k]) input = custom[f.k](values, onChange);
        else
          switch (f.type) {
            case "textarea":
              input = <Textarea value={val ?? ""} onChange={(e) => set(e.target.value)} />;
              break;
            case "number":
              input = (
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={val ?? ""}
                  onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))}
                />
              );
              break;
            case "select":
              input = (
                <Select
                  value={String(val ?? f.opts?.[0] ?? "")}
                  onChange={(e) => set(f.k === "key" ? e.target.value === "true" : e.target.value)}
                >
                  {/* 목록에 없는 기존 값도 보존(선택지에 추가) — 기존 버그: 첫 옵션으로 덮어쓰기 */}
                  {val != null && val !== "" && !(f.opts ?? []).includes(String(val)) && (
                    <option value={String(val)}>{t("shell.form.currentValue", { v: String(val) })}</option>
                  )}
                  {(f.opts ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o === ""
                        ? t("shell.form.noSelection")
                        : f.k === "key"
                          ? t(o === "true" ? "common.yes" : "common.no")
                          : (() => {
                              const g = enumGroupOf(f.k, f.opts);
                              return g ? label(g, o) : o;
                            })()}
                    </option>
                  ))}
                </Select>
              );
              break;
            case "pick":
              input = <PickInput value={val} onChange={set} opts={f.opts ?? []} />;
              break;
            case "picks":
              input = <PicksInput value={val} onChange={set} opts={f.opts ?? []} />;
              break;
            case "team":
              input = (
                <Select value={val ?? ""} onChange={(e) => set(e.target.value)}>
                  <option value="">{t("shell.form.noTeam")}</option>
                  {val && !TEAM_NAMES.includes(val) && <option value={val}>{t("shell.form.oldTeam", { v: val })}</option>}
                  {TEAM_NAMES.map((t: string) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              );
              break;
            case "dept":
              input = (
                <Select value={values.deptId ?? ""} onChange={(e) => onChange("deptId", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">{t("shell.form.noSelection")}</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({label("deptKind", d.kind)})
                    </option>
                  ))}
                </Select>
              );
              break;
            default:
              input = <Input value={val ?? ""} onChange={(e) => set(e.target.value)} />;
          }
        return (
          <Field key={f.k} label={fieldLabel(td, table, f.k, f.label)} error={errors?.[f.k] ? td(errors[f.k]) : undefined} className={span}>
            {input}
          </Field>
        );
      })}
    </div>
  );
}
