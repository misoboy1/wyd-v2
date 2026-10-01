import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/data";
import { useT } from "@/lib/i18n";

export function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { t } = useT();
  const mismatch = !!again && next !== again;
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api.post("/auth/password", { current: cur, next });
      toast.success(t("shell.pwd.done"));
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
      title={t("shell.changePassword")}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={busy} disabled={!cur || next.length < 8 || next !== again} onClick={() => void submit()}>
            {t("shell.pwd.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label={t("shell.pwd.current")}>
          <Input data-autofocus type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </Field>
        <Field label={t("shell.pwd.next")} hint={t("shell.pwd.nextHint")}>
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label={t("shell.pwd.again")} error={mismatch ? t("shell.pwd.mismatch") : err}>
          <Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
