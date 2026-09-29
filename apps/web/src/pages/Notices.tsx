import { useMemo, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import type { Notice } from "@wyd/shared";
import { todayKST } from "@wyd/shared";
import { Empty, PageHeader, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { EditDialog } from "@/components/form/EditDialog";
import { BoardCard, newestFirst } from "@/components/board/BoardCard";
import { RowActions } from "@/components/board/RowActions";
import { useTable } from "@/lib/data";
import { useCan } from "@/lib/auth";
import { matchQuery } from "@/lib/utils";

export default function Notices() {
  const { rows, isLoading } = useTable("notices");
  const { isAdmin } = useCan();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<{ row?: Notice | null } | null>(null);
  const list = useMemo(() => rows.filter((n) => matchQuery(q, n.title, n.body, n.author, n.date)).sort(newestFirst), [rows, q]);
  const defaults = useMemo(() => ({ title: "", body: "", author: "", date: todayKST() }), []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={<Megaphone />} title="공지사항" subtitle="본당·분과 공지 (관리자 작성) · 최신순"
        actions={isAdmin && <Button variant="primary" onClick={() => setEdit({})}><Plus />공지 작성</Button>} />
      {rows.length > 3 && <SearchInput value={q} onChange={setQ} placeholder="공지 검색: 제목·내용·작성 주체" className="mb-4" />}
      {isLoading ? <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
        : list.length ? (
          <div className="flex flex-col gap-3">
            {list.map((n) => (
              <BoardCard key={n.id} accent title={n.title} date={n.date} author={n.author} body={n.body}
                actions={isAdmin && <RowActions table="notices" row={n} label={n.title} onEdit={() => setEdit({ row: n })} />} />
            ))}
          </div>
        ) : <Empty icon={<Megaphone />} title={q ? "검색 결과가 없습니다." : "등록된 공지가 없습니다."} />}
      <EditDialog table="notices" open={!!edit} onOpenChange={(o) => !o && setEdit(null)} row={edit?.row} defaults={defaults}
        title={edit?.row ? "공지 수정" : "공지 작성"} />
    </div>
  );
}
