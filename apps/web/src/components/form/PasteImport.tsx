import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardPaste, AlertTriangle } from "lucide-react";
import { issueMsg, schemas, translateDynamic, type TableName } from "@wyd/shared";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { parsePaste } from "@/lib/csv";
import { bulkSave, toastBulk } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { fieldLabel } from "./RecordForm";

export interface PasteDef {
  label: string;
  table: TableName;
  cols: [key: string, header: string][];
  /** 파싱된 행 → 저장할 객체(참조 변환 등). 문자열을 반환하면 그 행은 오류 */
  mapRow?: (o: Record<string, string>) => Record<string, any> | string;
}

/** 엑셀에서 복사한 표를 붙여넣어 여러 행을 한 번에 추가. 미리보기에서 행별 검증 오류 표시 */
export function PasteImport({ def, open, onOpenChange }: { def: PasteDef; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const { t, td } = useT();
  const parsed = useMemo(() => {
    const rows = parsePaste(text);
    if (!rows.length) return [];
    // 첫 행이 머리글이면 건너뜀(열 이름과 절반 이상 일치). 화면 언어와 다른 언어(특히 한국어) 머리글도 인식
    const tdKo = (k: string) => translateDynamic("ko", k);
    const heads = def.cols.flatMap(([k, h]) => [h, fieldLabel(tdKo, def.table, k)].map((x) => x.replace(/\(.*\)/, "").trim()));
    const first = rows[0],
      hit = first.filter((c) => heads.some((h) => h && c.includes(h))).length;
    const data = hit >= Math.ceil(Math.min(first.length, def.cols.length) / 2) ? rows.slice(1) : rows;
    return data.map((r) => {
      const o: Record<string, string> = {};
      def.cols.forEach(([k], i) => {
        if (r[i] !== undefined && r[i] !== "") o[k] = r[i];
      });
      const mapped = def.mapRow ? def.mapRow(o) : o;
      if (typeof mapped === "string") return { raw: r, value: null, error: mapped };
      const z = (schemas as any)[def.table].safeParse(mapped);
      return {
        raw: r,
        value: z.success ? z.data : null,
        error: z.success
          ? ""
          : z.error.issues
              .map((i: any) => {
                const m = issueMsg(i),
                  msg = td(m.key, m.params);
                return i.path.length ? `${fieldLabel(td, def.table, String(i.path[0]))}: ${msg}` : msg;
              })
              .join(", "),
      };
    });
  }, [text, def, td]);
  const good = parsed.filter((p) => p.value);
  const commit = async () => {
    setBusy(true);
    const res = await bulkSave(
      qc,
      def.table,
      good.map((p) => p.value),
      (a, b) => setProgress(`${a}/${b}`),
    );
    toastBulk(t("shell.paste.toast", { label: def.label }), res);
    setBusy(false);
    setProgress("");
    setText("");
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      size="xl"
      title={
        <span className="inline-flex items-center gap-2">
          <ClipboardPaste className="size-4.5" />
          {t("shell.paste.title", { label: def.label })}
        </span>
      }
      description={
        <>
          {t("shell.paste.desc")} <b className="text-ink-2">{def.cols.map((c) => c[1]).join(" · ")}</b>
        </>
      }
      footer={
        <>
          <span className="mr-auto text-[13px] text-ink-3">
            {parsed.length ? t("shell.paste.status", { total: parsed.length, ok: good.length }) : ""}
            {progress && ` · ${t("shell.paste.progress", { p: progress })}`}
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={busy} disabled={!good.length} onClick={() => void commit()}>
            {t("shell.paste.addRows", { n: good.length })}
          </Button>
        </>
      }
    >
      <Textarea
        data-autofocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("shell.paste.placeholder")}
        className="min-h-32 font-mono text-[12.5px]"
      />
      {parsed.length > 0 && (
        <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-line">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-surface-2">
              <tr>
                <th className="px-2 py-1.5 text-left text-ink-3">#</th>
                {def.cols.map((c) => (
                  <th key={c[0]} className="px-2 py-1.5 text-left whitespace-nowrap text-ink-3">
                    {c[1]}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-left text-ink-3">{t("shell.paste.check")}</th>
              </tr>
            </thead>
            <tbody>
              {parsed.slice(0, 500).map((p, i) => (
                <tr key={i} className={p.error ? "bg-bad-soft/60" : ""}>
                  <td className="border-t border-line px-2 py-1 text-ink-3">{i + 1}</td>
                  {def.cols.map((_, j) => (
                    <td key={j} className="max-w-48 truncate border-t border-line px-2 py-1">
                      {p.raw[j]}
                    </td>
                  ))}
                  <td className="border-t border-line px-2 py-1">
                    {p.error ? (
                      <span className="inline-flex items-center gap-1 text-bad">
                        <AlertTriangle className="size-3.5" />
                        {p.error}
                      </span>
                    ) : (
                      <Badge tone="green">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
