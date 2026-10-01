import { useMemo, useState } from "react";
import { MessagesSquare, Plus } from "lucide-react";
import type { Post } from "@wyd/shared";
import { todayKST } from "@wyd/shared";
import { Empty, PageHeader, Segmented, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { EditDialog } from "@/components/form/EditDialog";
import { BoardCard, newestFirst } from "@/components/board/BoardCard";
import { RowActions } from "@/components/board/RowActions";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { matchQuery } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/** 게시판 — 로그인 사용자는 누구나 글쓰기, 수정·삭제는 작성자 본인 또는 관리자 */
export default function Posts() {
  const { rows, isLoading } = useTable("posts");
  const { t } = useT();
  const { user, loggedIn, canWrite } = useCan();
  const [q, setQ] = useState("");
  const [mine, setMine] = useState<"all" | "mine">("all");
  const [edit, setEdit] = useState<{ row?: Post | null } | null>(null);
  const list = useMemo(
    () =>
      rows.filter((p) => (mine === "all" || p.authorId === user?.id) && matchQuery(q, p.title, p.body, p.author, p.date)).sort(newestFirst),
    [rows, q, mine, user?.id],
  );
  const myCount = rows.filter((p) => user && p.authorId === user.id).length;
  const defaults = useMemo(() => ({ title: "", body: "", author: user?.name || "", date: todayKST() }), [user?.name]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={<MessagesSquare />}
        title={t("board.posts.title")}
        subtitle={t("board.posts.subtitle")}
        actions={
          loggedIn && (
            <Button variant="primary" onClick={() => setEdit({})}>
              <Plus />
              {t("board.posts.write")}
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder={t("board.posts.search")} className="min-w-56 flex-1" />
        {loggedIn && (
          <Segmented
            value={mine}
            onChange={setMine}
            options={[
              { value: "all", label: t("common.all"), count: rows.length },
              { value: "mine", label: t("board.posts.mine"), count: myCount },
            ]}
          />
        )}
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : list.length ? (
        <div className="flex flex-col gap-3">
          {list.map((p) => {
            const own = !!user && p.authorId === user.id;
            return (
              <BoardCard
                key={p.id}
                title={p.title}
                date={p.date}
                author={p.author}
                body={p.body}
                badges={own ? <Badge tone="blue">{t("board.posts.mine")}</Badge> : undefined}
                actions={canWrite("posts", p) && <RowActions table="posts" row={p} label={p.title} onEdit={() => setEdit({ row: p })} />}
              />
            );
          })}
        </div>
      ) : (
        <Empty icon={<MessagesSquare />} title={q || mine === "mine" ? t("board.posts.noMatch") : t("board.posts.empty")}>
          {loggedIn && !q && t("board.posts.firstPost")}
        </Empty>
      )}
      <EditDialog
        table="posts"
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        row={edit?.row}
        defaults={defaults}
        title={edit?.row ? t("board.posts.editTitle") : t("board.posts.write")}
        description={edit?.row ? undefined : t("board.posts.ownHint")}
      />
    </div>
  );
}
