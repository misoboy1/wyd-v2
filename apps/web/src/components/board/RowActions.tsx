import { Pencil, Trash2 } from "lucide-react";
import type { TableName } from "@wyd/shared";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { useRemove } from "@/lib/data";
import { useT } from "@/lib/i18n";

/** 편집·삭제 버튼(기존 rowActions) */
export function RowActions({
  table,
  row,
  label,
  onEdit,
}: {
  table: TableName;
  row: { id: number; version: number };
  label: string;
  onEdit: () => void;
}) {
  const { t } = useT();
  const remove = useRemove(table);
  const del = async () => {
    if (
      !(await confirm({
        title: t("board.deleteTitle"),
        body: t("board.deleteBody", { name: label }),
        confirmText: t("common.delete"),
        danger: true,
      }))
    )
      return;
    remove.mutate({ id: row.id, version: row.version });
  };
  return (
    <>
      <Button size="icon-sm" variant="ghost" aria-label={t("board.editAria", { name: label })} title={t("board.edit")} onClick={onEdit}>
        <Pencil />
      </Button>
      <Button
        size="icon-sm"
        variant="danger-ghost"
        aria-label={t("board.deleteAria", { name: label })}
        title={t("common.delete")}
        onClick={() => void del()}
      >
        <Trash2 />
      </Button>
    </>
  );
}
