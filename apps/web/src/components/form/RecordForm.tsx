import { useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { SCHEMA, TEAM_NAMES } from "@wyd/shared";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useTable } from "@/lib/data";
import { cn } from "@/lib/utils";

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

/** 선택 + 직접 입력(목록에 없으면 기타 입력) */
function PickInput({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
  const id = useMemo(() => "dl-" + Math.random().toString(36).slice(2, 8), []);
  return (
    <>
      <Input list={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="목록에서 선택하거나 직접 입력" />
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
              <button type="button" aria-label={`${x} 빼기`} onClick={() => set(list.filter((y) => y !== x))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
      </div>
      <Input
        className="mt-2 h-8 text-[13px]"
        value={extra}
        placeholder="기타 직접 입력 후 Enter"
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
  fields,
  values,
  onChange,
  custom,
  errors,
  className,
}: {
  fields: FieldDef[];
  values: Values;
  onChange: (k: string, v: any) => void;
  custom?: Record<string, (v: Values, set: (k: string, v: any) => void) => ReactNode>;
  errors?: Record<string, string>;
  className?: string;
}) {
  const { rows: depts } = useTable("departments");
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
                    <option value={String(val)}>{String(val)} (현재 값)</option>
                  )}
                  {(f.opts ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o === "" ? "선택 안 함" : o}
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
                  <option value="">팀 미배정</option>
                  {val && !TEAM_NAMES.includes(val) && <option value={val}>{val} (구 팀명)</option>}
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
                  <option value="">선택 안 함</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.kind})
                    </option>
                  ))}
                </Select>
              );
              break;
            default:
              input = <Input value={val ?? ""} onChange={(e) => set(e.target.value)} />;
          }
        return (
          <Field key={f.k} label={f.label} error={errors?.[f.k]} className={span}>
            {input}
          </Field>
        );
      })}
    </div>
  );
}
