import { useEffect, useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { TableName } from "@wyd/shared";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { RecordForm, schemaFields, type FieldDef } from "./RecordForm";
import { useRemove, useSave } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { ApiError } from "@/lib/api";

type Values = Record<string, any>;

/**
 * 추가·수정 공용 창. row가 있으면 수정(버전 포함 저장), 없으면 defaults로 추가.
 * 저장 중에는 닫히지 않고, 실패하면 창을 유지해 입력값을 잃지 않음.
 */
export function EditDialog({
  table,
  open,
  onOpenChange,
  row,
  defaults,
  title,
  description,
  fields,
  custom,
  transform,
  onSaved,
  deleteLabel,
  size = "lg",
  footerExtra,
  children,
}: {
  table: TableName;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row?: Values | null;
  defaults?: Values;
  title?: ReactNode;
  description?: ReactNode;
  fields?: FieldDef[];
  custom?: Record<string, (v: Values, set: (k: string, v: any) => void) => ReactNode>;
  /** 저장 직전 값 가공(예: 숙소 선택값 → facilityId/homestayId) */
  transform?: (v: Values) => Values;
  onSaved?: (saved: Values) => void;
  deleteLabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  footerExtra?: ReactNode;
  children?: ReactNode;
}) {
  const save = useSave(table);
  const remove = useRemove(table);
  const { canWrite } = useCan();
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // 창을 열 때(또는 다른 행으로 바뀔 때)만 초기화 — 열려 있는 동안 실시간 갱신(SSE)으로 입력값이 지워지지 않게
  const init = useRef({ row, defaults });
  init.current = { row, defaults };
  useEffect(() => {
    if (!open) return;
    const { row: r, defaults: d } = init.current;
    setValues(r ? { ...r } : { ...(d ?? {}) });
    setErrors({});
  }, [open, row?.id]);
  const f = fields ?? schemaFields(table);
  const editable = canWrite(table, row ?? values);

  const submit = async () => {
    setErrors({});
    const v = transform ? transform(values) : values;
    try {
      const saved = await save.mutateAsync(row ? { ...v, id: row.id, version: row.version } : v);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "VALIDATION" && Array.isArray(e.detail)) {
        const m: Record<string, string> = {};
        e.detail.forEach((i: { path: string; message: string }) => (m[i.path] = i.message));
        setErrors(m);
      }
      if (e instanceof ApiError && e.code === "CONFLICT") onOpenChange(false);
    }
  };
  const del = async () => {
    if (!row) return;
    if (!(await confirm({ title: "삭제할까요?", body: deleteLabel ?? "삭제하면 되돌릴 수 없습니다.", confirmText: "삭제", danger: true })))
      return;
    remove.mutate({ id: row.id, version: row.version });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !save.isPending && onOpenChange(o)}
      size={size}
      title={title ?? (row ? "수정" : "추가")}
      description={description}
      footer={
        <>
          {row && editable && (
            <Button variant="danger-ghost" className="mr-auto" onClick={() => void del()}>
              <Trash2 />
              삭제
            </Button>
          )}
          {footerExtra}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            취소
          </Button>
          {editable && (
            <Button variant="primary" loading={save.isPending} onClick={() => void submit()}>
              저장
            </Button>
          )}
        </>
      }
    >
      {children}
      <fieldset disabled={!editable || save.isPending} className="contents">
        <RecordForm fields={f} values={values} onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))} custom={custom} errors={errors} />
      </fieldset>
    </Dialog>
  );
}
