import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Home, KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCog, Users as UsersIcon } from "lucide-react";
import type { Homestay, Role } from "@wyd/shared";
import { TEAM_NAMES, cmpStr } from "@wyd/shared";
import { Empty, PageHeader, Segmented, Skeleton, Stat } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { confirm } from "@/components/ui/confirm";
import { Checkbox, Field, Input, SearchInput, Select } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/table";
import { api } from "@/lib/api";
import { ROLE_LABEL, useAuth } from "@/lib/auth";
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
const ROLE_HELP: Record<Role, string> = {
  admin: "모든 화면을 보고 모든 자료를 수정할 수 있습니다. 계정 관리도 할 수 있습니다.",
  dept: "모든 화면을 볼 수 있고, 자기 팀 봉사자만 추가·수정·삭제할 수 있습니다. 팀을 꼭 지정하세요.",
  host: "자기 가정 정보와 배정된 순례자만 볼 수 있습니다. 연결할 홈스테이 가정을 꼭 지정하세요.",
};

const fmtTime = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(+d)
    ? "—"
    : new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);
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
      toast.success(row ? "계정을 수정했습니다." + (f.password ? " (비밀번호 재설정됨)" : "") : "계정을 만들었습니다.");
      onOpenChange(false);
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const submit = () => {
    setErr("");
    if (f.username.trim().length < 2) return setErr("아이디는 2자 이상이어야 합니다.");
    if (!row && f.password.length < 8) return setErr("비밀번호는 8자 이상이어야 합니다.");
    if (row && f.password && f.password.length < 8) return setErr("새 비밀번호는 8자 이상이어야 합니다.");
    if (f.role === "dept" && !f.team) return setErr("분과 책임자는 팀을 지정해야 합니다.");
    if (f.role === "host" && !f.homestayId) return setErr("홈스테이 가정 계정은 연결할 가정을 지정해야 합니다.");
    save.mutate();
  };
  const hsSorted = useMemo(() => homestays.slice().sort((a, b) => cmpStr(a.hid, b.hid)), [homestays]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !save.isPending && onOpenChange(o)}
      size="md"
      title={row ? `계정 수정 · ${row.username}` : "새 계정"}
      description={
        row
          ? "비밀번호·권한·팀·가정·활성 상태를 바꾸면 그 계정은 다시 로그인해야 합니다."
          : "아이디와 초기 비밀번호를 사용자에게 따로 전달하세요."
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            취소
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {row ? "저장" : "만들기"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="아이디" required hint="영문·숫자·._@- 만 사용">
          <Input data-autofocus value={f.username} autoComplete="off" onChange={(e) => set("username", e.target.value)} />
        </Field>
        <Field label="이름">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 최양업 토마스" />
        </Field>
        <Field label="권한" required className="sm:col-span-2">
          <Select value={f.role} disabled={self} onChange={(e) => set("role", e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
          <span className="mt-1 block text-[12px] text-ink-3">
            {self ? "자기 자신의 관리자 권한은 해제할 수 없습니다." : ROLE_HELP[f.role]}
          </span>
        </Field>
        {f.role === "dept" && (
          <Field label="팀" required className="sm:col-span-2" hint="이 팀의 봉사자만 추가·수정할 수 있습니다.">
            <Select value={f.team} onChange={(e) => set("team", e.target.value)}>
              <option value="">팀 선택</option>
              {f.team && !TEAM_NAMES.includes(f.team) && <option value={f.team}>{f.team} (구 팀명)</option>}
              {TEAM_NAMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {f.role === "host" && (
          <Field label="연결할 홈스테이 가정" required className="sm:col-span-2" hint="이 가정 정보와 배정된 순례자만 볼 수 있습니다.">
            <Select value={f.homestayId ?? ""} onChange={(e) => set("homestayId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">가정 선택</option>
              {hsSorted.map((h) => (
                <option key={h.id} value={h.id}>
                  {hsLabel(h)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={row ? "새 비밀번호 (재설정할 때만)" : "초기 비밀번호"} required={!row} className="sm:col-span-2" hint="8자 이상">
          <Input
            type="password"
            autoComplete="new-password"
            value={f.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder={row ? "비워 두면 그대로 유지" : ""}
          />
        </Field>
        {row && (
          <div className="sm:col-span-2">
            <Checkbox
              checked={f.active}
              onChange={(v) => !self && set("active", v)}
              label={
                <>
                  활성 계정 <span className="text-ink-3">(끄면 로그인할 수 없음)</span>
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
  return (
    <Card className="mb-4 p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
        <UserCog className="size-4.5 text-ink-3" />
        권한 안내
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-line bg-surface-2/50 p-3">
            <Badge tone={ROLE_TONE[r]}>{ROLE_LABEL[r]}</Badge>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              {r === "admin" ? "전체 편집" : r === "dept" ? "모두 보기 · 자기 팀 봉사자 편집" : "자기 가정·게스트만 보기"}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{ROLE_HELP[r]}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">
        로그인하지 않은 방문자는 대시보드·D-DAY 준비·일정표·공지사항·Q&A·추천 장소·고리기도만 볼 수 있습니다.
      </p>
    </Card>
  );
}

export default function Users() {
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
          matchQuery(q, u.username, u.name, ROLE_LABEL[u.role], u.team, hsLabel(hsById.get(u.homestayId ?? -1))),
      ),
    [users, role, q, hsById],
  );

  const del = async (u: Account) => {
    if (
      !(await confirm({
        title: `계정 '${u.username}'을(를) 삭제할까요?`,
        body: "삭제하면 되돌릴 수 없습니다. 잠시 막으려면 편집에서 '활성'을 끄세요.",
        confirmText: "삭제",
        danger: true,
        typeToConfirm: u.username,
      }))
    )
      return;
    try {
      await api.del(`/users/${u.id}`);
      toast.success("계정을 삭제했습니다.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      await qc.invalidateQueries({ queryKey: USERS_KEY });
    }
  };

  const columns: Column<Account>[] = [
    {
      key: "username",
      header: "아이디",
      sortValue: (u) => u.username,
      cell: (u) => (
        <span className="font-semibold whitespace-nowrap">
          {u.username}
          {u.id === me?.id && (
            <Badge tone="outline" className="ml-1.5">
              나
            </Badge>
          )}
        </span>
      ),
    },
    { key: "name", header: "이름", sortValue: (u) => u.name, cell: (u) => u.name || <span className="text-ink-3">—</span> },
    {
      key: "role",
      header: "권한",
      sortValue: (u) => ROLES.indexOf(u.role),
      cell: (u) => <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>,
    },
    {
      key: "link",
      header: "팀 / 가정",
      cell: (u) => {
        if (u.role === "dept")
          return u.team ? <Badge tone="blue">{u.team}</Badge> : <span className="text-[12.5px] text-bad">팀 미지정</span>;
        if (u.role === "host") {
          const h = hsById.get(u.homestayId ?? -1);
          return h ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Home className="size-3.5 text-ink-3" />
              {hsLabel(h)}
            </span>
          ) : (
            <span className="text-[12.5px] text-bad">{u.homestayId ? "가정 없음(삭제됨)" : "가정 미지정"}</span>
          );
        }
        return <span className="text-ink-3">전체</span>;
      },
    },
    {
      key: "active",
      header: "상태",
      sortValue: (u) => (u.active ? 0 : 1),
      cell: (u) => <Badge tone={u.active ? "green" : "gray"}>{u.active ? "활성" : "비활성"}</Badge>,
    },
    {
      key: "last",
      header: "마지막 로그인",
      sortValue: (u) => u.lastLoginAt ?? "",
      hideOnMobile: true,
      cell: (u) => <span className="whitespace-nowrap text-ink-2 tabular">{fmtTime(u.lastLoginAt)}</span>,
    },
    {
      key: "act",
      header: "관리",
      cell: (u) => (
        <div className="flex items-center gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <Button size="icon-sm" variant="ghost" aria-label={`${u.username} 편집`} title="편집" onClick={() => setEdit({ row: u })}>
            <Pencil />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${u.username} 비밀번호 재설정`}
            title="비밀번호 재설정"
            onClick={() => setEdit({ row: u })}
          >
            <KeyRound />
          </Button>
          {u.id !== me?.id && (
            <Button size="icon-sm" variant="danger-ghost" aria-label={`${u.username} 삭제`} title="삭제" onClick={() => void del(u)}>
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
        title="계정 관리"
        subtitle="본당 관리자 전용 · 봉사자·가정 로그인 계정과 권한"
        actions={
          <Button variant="primary" onClick={() => setEdit({ row: null })}>
            <Plus />새 계정
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="전체 계정" value={users.length} icon={<UsersIcon />} />
        <Stat label={ROLE_LABEL.admin} value={count("admin")} />
        <Stat label={ROLE_LABEL.dept} value={count("dept")} tone="primary" />
        <Stat label={ROLE_LABEL.host} value={count("host")} tone="gold" hint={`비활성 ${users.filter((u) => !u.active).length}개`} />
      </div>
      <RoleHelp />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <SearchInput value={q} onChange={setQ} placeholder="검색: 아이디·이름·팀·가정" className="min-w-56 flex-1" />
          <Segmented
            value={role}
            onChange={setRole}
            options={[
              { value: "all", label: "전체", count: users.length },
              ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r], count: count(r) })),
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
          <Empty icon={<ShieldCheck />} title="계정 목록을 불러오지 못했습니다.">
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
            empty={<Empty icon={<UsersIcon />} title={users.length ? "조건에 맞는 계정이 없습니다." : "계정이 없습니다."} />}
          />
        )}
      </Card>
      <AccountDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} row={edit?.row ?? null} homestays={homestays} meId={me?.id} />
    </div>
  );
}
