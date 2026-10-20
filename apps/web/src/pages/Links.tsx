import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Printer, QrCode, Trash2 } from "lucide-react";
import type { PersonalLinkInfo, PersonKind } from "@wyd/shared";
import { Empty, PageHeader, Segmented, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, SearchInput } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { confirm } from "@/components/ui/confirm";
import { api, type ApiError } from "@/lib/api";
import { useTable } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { printQrCards } from "@/lib/print";
import { personalUrl, qrPath } from "@/lib/qr";
import { matchQuery } from "@/lib/utils";

interface Row {
  id: number;
  name: string;
  sub: string;
}
interface Issued {
  kind: PersonKind;
  refId: number;
  token: string;
}
const linksKey = ["links"] as const;

function Qr({ text }: { text: string }) {
  const { size, d } = useMemo(() => qrPath(text), [text]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="size-24 shrink-0 rounded bg-white" shapeRendering="crispEdges" aria-hidden>
      <path d={d} className="fill-black" />
    </svg>
  );
}

/** 개인 링크·QR 발급(관리자) — 계정 없는 순례자·봉사자가 메시지를 받을 수 있게 */
export default function Links() {
  const { t, date } = useT();
  const qc = useQueryClient();
  const [kind, setKind] = useState<PersonKind>("visitor");
  const [q, setQ] = useState("");
  const [onlyNone, setOnlyNone] = useState(false);
  const [sel, setSel] = useState<Set<number>>(() => new Set());
  const [issued, setIssued] = useState<Issued[] | null>(null);
  const { rows: visitors, isLoading: vl } = useTable("visitors");
  const { rows: volunteers, isLoading: ol } = useTable("volunteers");
  const links = useQuery({ queryKey: linksKey, queryFn: () => api.get<PersonalLinkInfo[]>("/links") });

  const people: Row[] = useMemo(
    () =>
      kind === "visitor"
        ? visitors.map((v) => ({ id: v.id, name: v.name, sub: [v.pid, v.gno, v.country].filter(Boolean).join(" · ") }))
        : volunteers.map((v) => ({ id: v.id, name: v.name, sub: v.team })),
    [kind, visitors, volunteers],
  );
  const linkOf = useMemo(() => {
    const m = new Map<number, PersonalLinkInfo>();
    for (const l of links.data ?? []) if (l.kind === kind && !m.has(l.refId)) m.set(l.refId, l);
    return m;
  }, [links.data, kind]);
  const shown = useMemo(
    () => people.filter((p) => (!onlyNone || !linkOf.has(p.id)) && matchQuery(q, p.name, p.sub)),
    [people, onlyNone, linkOf, q],
  );
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const allOn = shown.length > 0 && shown.every((p) => sel.has(p.id));

  const issue = useMutation({
    mutationFn: (ids: number[]) => api.post<Issued[]>("/links", { kind, ids }),
    onSuccess: (r) => {
      toast.success(t("inbox.links.issued", { n: r.length }));
      setIssued(r);
      setSel(new Set());
      void qc.invalidateQueries({ queryKey: linksKey });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api.del(`/links/${kind}/${id}`),
    onSuccess: () => {
      toast.success(t("inbox.links.revoked"));
      void qc.invalidateQueries({ queryKey: linksKey });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const askIssue = async () => {
    const ids = [...sel];
    if (await confirm({ title: t("inbox.links.issueQ", { n: ids.length }), body: t("inbox.links.issueBody") })) issue.mutate(ids);
  };
  const askRevoke = async (p: Row) => {
    if (await confirm({ title: t("inbox.links.revokeQ", { name: p.name }), body: t("inbox.links.revokeBody"), danger: true }))
      revoke.mutate(p.id);
  };
  const toggle = (id: number, on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const print = () =>
    printQrCards(
      t("inbox.links.resultTitle"),
      (issued ?? []).map((x) => ({
        name: byId.get(x.refId)?.name ?? "",
        sub: byId.get(x.refId)?.sub,
        qr: qrPath(personalUrl(x.token)),
        hint: t("inbox.links.cardHint"),
      })),
    );
  const copy = (token: string) =>
    navigator.clipboard.writeText(personalUrl(token)).then(
      () => toast.success(t("inbox.links.copied")),
      () => toast.error(t("err.request")),
    );

  const loading = (kind === "visitor" ? vl : ol) || links.isLoading;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={<QrCode />}
        title={t("inbox.links.title")}
        subtitle={t("inbox.links.subtitle")}
        actions={
          <Button variant="primary" disabled={!sel.size} loading={issue.isPending} onClick={() => void askIssue()}>
            <QrCode />
            {t("inbox.links.issue", { n: sel.size })}
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          value={kind}
          onChange={(k) => {
            setKind(k);
            setSel(new Set());
          }}
          options={[
            { value: "visitor", label: t("inbox.kind.visitor"), count: visitors.length },
            { value: "volunteer", label: t("inbox.kind.volunteer"), count: volunteers.length },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder={t("inbox.links.search")} className="min-w-48 flex-1" />
        <Checkbox checked={onlyNone} onChange={setOnlyNone} label={t("inbox.links.onlyNone")} />
      </div>
      {loading ? (
        <Skeleton className="h-64" />
      ) : shown.length ? (
        <div className="rounded-2xl border border-line bg-surface shadow-soft">
          <div className="border-b border-line px-4 py-2">
            <Checkbox
              checked={allOn}
              onChange={(on) =>
                setSel((s) => {
                  const n = new Set(s);
                  shown.forEach((p) => (on ? n.add(p.id) : n.delete(p.id)));
                  return n;
                })
              }
              label={t("inbox.links.selectAll")}
            />
          </div>
          <ul className="divide-y divide-line">
            {shown.map((p) => {
              const l = linkOf.get(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-[var(--primary)]"
                    checked={sel.has(p.id)}
                    onChange={(e) => toggle(p.id, e.target.checked)}
                    aria-label={t("inbox.links.selectRow", { name: p.name })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-ink">{p.name}</div>
                    {p.sub && <div className="truncate text-[12px] text-ink-3">{p.sub}</div>}
                  </div>
                  {l ? (
                    <Badge tone="green">{t("inbox.links.issuedOn", { date: date(l.createdAt, { dateStyle: "short" }) })}</Badge>
                  ) : (
                    <Badge tone="gray">{t("inbox.links.none")}</Badge>
                  )}
                  {l && (
                    <Button
                      variant="danger-ghost"
                      size="icon-sm"
                      aria-label={t("inbox.links.revokeAria", { name: p.name })}
                      onClick={() => void askRevoke(p)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <Empty icon={<QrCode />} title={t("common.noResults")} />
      )}

      <Dialog
        open={!!issued}
        onOpenChange={(o) => !o && setIssued(null)}
        title={t("inbox.links.resultTitle")}
        description={t("inbox.links.resultDesc")}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIssued(null)}>
              {t("common.close")}
            </Button>
            <Button variant="primary" onClick={print}>
              <Printer />
              {t("inbox.links.print")}
            </Button>
          </>
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {(issued ?? []).map((x) => (
            <li key={x.refId} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <Qr text={personalUrl(x.token)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-ink">{byId.get(x.refId)?.name}</div>
                <div className="truncate text-[12px] text-ink-3">{byId.get(x.refId)?.sub}</div>
                <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => void copy(x.token)}>
                  <Copy />
                  {t("inbox.links.copy")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
