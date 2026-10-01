import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Home, KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCog, Users as UsersIcon } from "lucide-react";
import type { Homestay, Role } from "@wyd/shared";
import { TEAM_NAMES, cmpStr, enumLabel } from "@wyd/shared";
import { Empty, PageHeader, Segmented, Skeleton, Stat } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { confirm } from "@/components/ui/confirm";
import { Checkbox, Field, Input, SearchInput, Select } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { errorMessage, useTable } from "@/lib/data";
import { matchQuery } from "@/lib/utils";

interface Account {
  id: number;
  username: string;
  name: string;
  role: Role;
  team: string;
  homestayId: number | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt?: string;
}
const USERS_KEY = ["users"] as const;
const ROLE_TONE: Record<Role, Tone> = { admin: "red", dept: "blue", host: "gold" };
const ROLES: Role[] = ["admin", "dept", "host"];
const TIME_OPTS: Intl.DateTimeFormatOptions = {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};
const hsLabel = (h?: Homestay) => (h ? [h.hid, h.host, h.zone].filter(Boolean).join(" · ") : "");

interface Form {
  username: string;
  name: string;
  role: Role;
  team: string;
  homestayId: number | null;
  active: boolean;
  password: string;
}
const EMPTY: Form = { username: "", name: "", role: "dept", team: "", homestayId: null, active: true, password: "" };

function AccountDialog({
  open,
  onOpenChange,
  row,
  homestays,
  meId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: Account | null;
  homestays: Homestay[];
  meId?: number;
}) {
  const { t, label } = useT();
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(EMPTY);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!open) return;
    setErr("");
    setF(
      row
        ? {
            username: row.username,
            name: row.name,
            role: row.role,
            team: row.team || "",
            homestayId: row.homestayId,
            active: row.active,
            password: "",
          }
        : EMPTY,
    );
  }, [open, row]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const self = !!row && row.id === meId;

  const save = useMutation({
    mutationFn: async () => {
      // 권한에 맞지 않는 연결 정보는 비움(분과=팀, 가정=홈스테이)
      const body: Record<string, unknown> = {
        username: f.username.trim(),
        name: f.name.trim(),
        role: f.role,
        team: f.role === "dept" ? f.team : "",
        homestayId: f.role === "host" ? f.homestayId : null,
      };
      if (row) {
        body.active = f.active;
        if (f.password) body.password = f.password;
        return api.patch<Account>(`/users/${row.id}`, body);
      }
      return api.post<Account>("/users", { ...body, password: f.password });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: USERS_KEY });
      toast.success(row ? t(f.password ? "users.updatedPw" : "users.updated") : t("users.created"));
      onOpenChange(false);
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const submit = () => {
    setErr("");
    if (f.username.trim().length < 2) return setErr(t("users.usernameMin"));
    if (!row && f.password.length < 8) return setErr(t("users.pwMin"));
    if (row && f.password && f.password.length < 8) return setErr(t("users.newPwMin"));
    if (f.role === "dept" && !f.team) return setErr(t("users.deptNeedsTeam"));
    if (f.role === "host" && !f.homestayId) return setErr(t("users.hostNeedsHome"));
    save.mutate();
  };
  const hsSorted = useMemo(() => homestays.slice().sort((a, b) => cmpStr(a.hid, b.hid)), [homestays]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !save.isPending && onOpenChange(o)}
      size="md"
      title={row ? t("users.editTitle", { username: row.username }) : t("users.newTitle")}
      description={row ? t("users.editDesc") : t("users.newDesc")}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {row ? t("common.save") : t("users.create")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label={t("users.username")} required hint={t("users.usernameHint")}>
          <Input data-autofocus value={f.username} autoComplete="off" onChange={(e) => set("username", e.target.value)} />
        </Field>
        <Field label={t("users.name")}>
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder={t("users.namePh")} />
        </Field>
        <Field label={t("users.role")} required className="sm:col-span-2">
          <Select value={f.role} disabled={self} onChange={(e) => set("role", e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {label("appRole", r)}
              </option>
            ))}
          </Select>
          <span className="mt-1 block text-[12px] text-ink-3">{self ? t("users.selfRole") : t(`users.roleHelp.${f.role}`)}</span>
        </Field>
        {f.role === "dept" && (
          <Field label={t("users.team")} required className="sm:col-span-2" hint={t("users.teamHint")}>
            <Select value={f.team} onChange={(e) => set("team", e.target.value)}>
              <option value="">{t("users.teamPick")}</option>
              {f.team && !TEAM_NAMES.includes(f.team) && <option value={f.team}>{t("org.oldTeamOpt", { team: f.team })}</option>}
              {TEAM_NAMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {f.role === "host" && (
          <Field label={t("users.home")} required className="sm:col-span-2" hint={t("users.homeHint")}>
            <Select value={f.homestayId ?? ""} onChange={(e) => set("homestayId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">{t("users.homePick")}</option>
              {hsSorted.map((h) => (
                <option key={h.id} value={h.id}>
                  {hsLabel(h)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={row ? t("users.newPw") : t("users.initPw")} required={!row} className="sm:col-span-2" hint={t("users.pwHint")}>
          <Input
            type="password"
            autoComplete="new-password"
            value={f.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder={row ? t("users.keepPw") : ""}
          />
        </Field>
        {row && (
          <div className="sm:col-span-2">
            <Checkbox
              checked={f.active}
              onChange={(v) => !self && set("active", v)}
              label={
                <>
                  {t("users.activeAccount")} <span className="text-ink-3">{t("users.activeHint")}</span>
                </>
              }
            />
          </div>
        )}
        {err && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad sm:col-span-2">
            {err}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function RoleHelp() {
  const { t, label } = useT();
  return (
    <Card className="mb-4 p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
        <UserCog className="size-4.5 text-ink-3" />
        {t("users.roleHelpTitle")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-line bg-surface-2/50 p-3">
            <Badge tone={ROLE_TONE[r]}>{label("appRole", r)}</Badge>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{t(`users.roleShort.${r}`)}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{t(`users.roleHelp.${r}`)}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">{t("users.guestNote")}</p>
    </Card>
  );
}

export default function Users() {
  const { t, label, date, locale } = useT();
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { data: users = [], isLoading, error } = useQuery({ queryKey: USERS_KEY, queryFn: () => api.get<Account[]>("/users") });
  const { rows: homestays } = useTable("homestays");
  const hsById = useMemo(() => new Map(homestays.map((h) => [h.id, h])), [homestays]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const [edit, setEdit] = useState<{ row: Account | null } | null>(null);

  const list = useMemo(
    () =>
      users.filter(
        (u) =>
          (role === "all" || u.role === role) &&
          matchQuery(q, u.username, u.name, enumLabel(locale, "appRole", u.role), u.team, hsLabel(hsById.get(u.homestayId ?? -1))),
      ),
    [users, role, q, hsById, locale],
  );

  const del = async (u: Account) => {
    if (
      !(await confirm({
        title: t("users.delTitle", { username: u.username }),
        body: t("users.delBody"),
        confirmText: t("common.delete"),
        danger: true,
        typeToConfirm: u.username,
      }))
    )
      return;
    try {
      await api.del(`/users/${u.id}`);
      toast.success(t("users.deleted"));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      await qc.invalidateQueries({ queryKey: USERS_KEY });
    }
  };

  const columns: Column<Account>[] = [
    {
      key: "username",
      header: t("users.username"),
      sortValue: (u) => u.username,
      cell: (u) => (
        <span className="font-semibold whitespace-nowrap">
          {u.username}
          {u.id === me?.id && (
            <Badge tone="outline" className="ml-1.5">
              {t("users.me")}
            </Badge>
          )}
        </span>
      ),
    },
    { key: "name", header: t("users.name"), sortValue: (u) => u.name, cell: (u) => u.name || <span className="text-ink-3">—</span> },
    {
      key: "role",
      header: t("users.role"),
      sortValue: (u) => ROLES.indexOf(u.role),
      cell: (u) => <Badge tone={ROLE_TONE[u.role]}>{label("appRole", u.role)}</Badge>,
    },
    {
      key: "link",
      header: t("users.colLink"),
      cell: (u) => {
        if (u.role === "dept")
          return u.team ? <Badge tone="blue">{u.team}</Badge> : <span className="text-[12.5px] text-bad">{t("users.noTeam")}</span>;
        if (u.role === "host") {
          const h = hsById.get(u.homestayId ?? -1);
          return h ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Home className="size-3.5 text-ink-3" />
              {hsLabel(h)}
            </span>
          ) : (
            <span className="text-[12.5px] text-bad">{u.homestayId ? t("users.homeGone") : t("users.noHome")}</span>
          );
        }
        return <span className="text-ink-3">{t("common.all")}</span>;
      },
    },
    {
      key: "active",
      header: t("users.colStatus"),
      sortValue: (u) => (u.active ? 0 : 1),
      cell: (u) => <Badge tone={u.active ? "green" : "gray"}>{u.active ? t("users.active") : t("users.inactive")}</Badge>,
    },
    {
      key: "last",
      header: t("users.colLast"),
      sortValue: (u) => u.lastLoginAt ?? "",
      hideOnMobile: true,
      cell: (u) => <span className="whitespace-nowrap text-ink-2 tabular">{(u.lastLoginAt && date(u.lastLoginAt, TIME_OPTS)) || "—"}</span>,
    },
    {
      key: "act",
      header: t("users.colManage"),
      cell: (u) => (
        <div className="flex items-center gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("users.editName", { name: u.username })}
            title={t("users.edit")}
            onClick={() => setEdit({ row: u })}
          >
            <Pencil />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("users.resetPwName", { name: u.username })}
            title={t("users.resetPw")}
            onClick={() => setEdit({ row: u })}
          >
            <KeyRound />
          </Button>
          {u.id !== me?.id && (
            <Button
              size="icon-sm"
              variant="danger-ghost"
              aria-label={t("users.deleteName", { name: u.username })}
              title={t("common.delete")}
              onClick={() => void del(u)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const count = (r: Role) => users.filter((u) => u.role === r).length;
  return (
    <div>
      <PageHeader
        icon={<ShieldCheck />}
        title={t("nav.users")}
        subtitle={t("users.subtitle")}
        actions={
          <Button variant="primary" onClick={() => setEdit({ row: null })}>
            <Plus />
            {t("users.newAccount")}
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("users.totalAccounts")} value={users.length} icon={<UsersIcon />} />
        <Stat label={label("appRole", "admin")} value={count("admin")} />
        <Stat label={label("appRole", "dept")} value={count("dept")} tone="primary" />
        <Stat
          label={label("appRole", "host")}
          value={count("host")}
          tone="gold"
          hint={t("users.inactiveCount", { n: users.filter((u) => !u.active).length })}
        />
      </div>
      <RoleHelp />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <SearchInput value={q} onChange={setQ} placeholder={t("users.searchPh")} className="min-w-56 flex-1" />
          <Segmented
            value={role}
            onChange={setRole}
            options={[
              { value: "all", label: t("common.all"), count: users.length },
              ...ROLES.map((r) => ({ value: r, label: label("appRole", r), count: count(r) })),
            ]}
          />
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : error ? (
          <Empty icon={<ShieldCheck />} title={t("users.loadFail")}>
            {errorMessage(error)}
          </Empty>
        ) : (
          <DataTable
            rows={list}
            columns={columns}
            rowKey={(u) => u.id}
            onRowClick={(u) => setEdit({ row: u })}
            initialSort={{ key: "role", dir: 1 }}
            rowClassName={(u) => (u.active ? undefined : "opacity-60")}
            empty={<Empty icon={<UsersIcon />} title={users.length ? t("users.noMatch") : t("users.noAccounts")} />}
          />
        )}
      </Card>
      <AccountDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} row={edit?.row ?? null} homestays={homestays} meId={me?.id} />
    </div>
  );
}
