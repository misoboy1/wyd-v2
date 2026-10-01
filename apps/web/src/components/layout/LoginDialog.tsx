import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { useT } from "@/lib/i18n";

export function LoginDialog() {
  const { loginOpen, setLoginOpen, login } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { t } = useT();
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await login(u.trim(), p);
      setLoginOpen(false);
      setP("");
      toast.success(t("shell.loginDlg.done"));
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={loginOpen}
      onOpenChange={setLoginOpen}
      size="sm"
      title={t("shell.login")}
      description={t("shell.loginDlg.desc")}
      footer={
        <Button variant="primary" loading={busy} onClick={() => void submit()} disabled={!u || !p}>
          {t("shell.login")}
        </Button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label={t("shell.loginDlg.username")}>
          <Input data-autofocus autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} />
        </Field>
        <Field label={t("shell.loginDlg.password")} error={err}>
          <Input type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}
