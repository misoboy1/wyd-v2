import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/data";

export function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const mismatch = !!again && next !== again;
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api.post("/auth/password", { current: cur, next });
      toast.success("비밀번호를 바꿨습니다. 다른 기기는 로그아웃됩니다.");
      onOpenChange(false);
      setCur("");
      setNext("");
      setAgain("");
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="비밀번호 변경"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button variant="primary" loading={busy} disabled={!cur || next.length < 8 || next !== again} onClick={() => void submit()}>
            변경
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="현재 비밀번호">
          <Input data-autofocus type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </Field>
        <Field label="새 비밀번호" hint="8자 이상">
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="새 비밀번호 확인" error={mismatch ? "새 비밀번호가 서로 다릅니다." : err}>
          <Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
