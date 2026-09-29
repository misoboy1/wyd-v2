import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/data";

export function LoginDialog() {
  const { loginOpen, setLoginOpen, login } = useAuth();
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault(); setBusy(true); setErr("");
    try { await login(u.trim(), p); setLoginOpen(false); setP(""); toast.success("로그인했습니다."); }
    catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={loginOpen} onOpenChange={setLoginOpen} size="sm" title="로그인" description="봉사자 계정으로 로그인하세요. 계정은 본당 관리자가 발급합니다."
      footer={<Button variant="primary" loading={busy} onClick={() => void submit()} disabled={!u || !p}>로그인</Button>}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label="아이디"><Input data-autofocus autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} /></Field>
        <Field label="비밀번호" error={err}><Input type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}
