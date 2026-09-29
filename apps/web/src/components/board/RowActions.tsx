import { Pencil, Trash2 } from "lucide-react";
import type { TableName } from "@wyd/shared";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { useRemove } from "@/lib/data";

/** 편집·삭제 버튼(기존 rowActions) */
export function RowActions({ table, row, label, onEdit }: { table: TableName; row: { id: number; version: number }; label: string; onEdit: () => void }) {
  const remove = useRemove(table);
  const del = async () => {
    if (!(await confirm({ title: "삭제할까요?", body: `'${label}'을(를) 삭제하면 되돌릴 수 없습니다.`, confirmText: "삭제", danger: true }))) return;
    remove.mutate({ id: row.id, version: row.version });
  };
  return (
    <>
      <Button size="icon-sm" variant="ghost" aria-label={`${label} 편집`} title="편집" onClick={onEdit}><Pencil /></Button>
      <Button size="icon-sm" variant="danger-ghost" aria-label={`${label} 삭제`} title="삭제" onClick={() => void del()}><Trash2 /></Button>
    </>
  );
}
