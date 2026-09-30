import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { getEmailSettingsAdmin, saveEmailSettings, sendTestEmail } from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/admin/email")({
  head: () => ({
    meta: [
      { title: "Email settings — Usikose360 Admin" },
      { name: "description", content: "Configure the SMTP mail server used for tickets and account emails." },
      { property: "og:title", content: "Email settings — Usikose360 Admin" },
      { property: "og:description", content: "SMTP setup, test email and delivery log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminEmail,
});

type Form = {
  enabled: boolean;
  host: string;
  port: number;
  security: "ssl" | "starttls" | "none";
  username: string;
  password: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  allow_self_signed: boolean;
};

function AdminEmail() {
  const { isAdmin, loading, user } = useAuth();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getEmailSettingsAdmin);
  const saveFn = useServerFn(saveEmailSettings);
  const testFn = useServerFn(sendTestEmail);
  const q = useQuery({ queryKey: ["email-settings"], queryFn: () => fetchFn(), enabled: isAdmin });
  const [f, setF] = useState<Form | null>(null);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test">("");

  useEffect(() => {
    if (q.data && !f) {
      const s = q.data.settings;
      setF({ ...s, security: s.security as Form["security"], password: "" });
    }
  }, [q.data, f]);
  useEffect(() => {
    if (user?.email && !testTo) setTestTo(user.email);
  }, [user, testTo]);

  const set = (p: Partial<Form>) => setF((x) => (x ? { ...x, ...p } : x));

  async function save() {
    if (!f) return;
    setBusy("save");
    try {
      await saveFn({ data: { ...f, password: f.password || undefined } });
      toast.success("Email settings saved");
      set({ password: "" });
      qc.invalidateQueries({ queryKey: ["email-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy("");
    }
  }

  async function test() {
    setBusy("test");
    try {
      await testFn({ data: { to: testTo } });
      toast.success(`Test email sent to ${testTo}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sending failed");
    } finally {
      setBusy("");
      qc.invalidateQueries({ queryKey: ["email-settings"] });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Mail className="h-7 w-7 text-primary" /> Email settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tickets, password and payment emails are sent through your own mail server (SMTP).
      </p>
      {!loading && !isAdmin ? (
        <div className="surface-panel mt-8 rounded-xl border border-border/70 p-8 text-center text-sm text-muted-foreground">
          Only system administrators can open this page.
        </div>
      ) : !f ? (
        <Skeleton className="mt-8 h-96 rounded-xl" />
      ) : (
        <div className="mt-8 space-y-6">
          <section className="surface-panel space-y-5 rounded-xl border border-border/70 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Send emails</p>
                <p className="text-xs text-muted-foreground">When off, no emails are sent.</p>
              </div>
              <Switch checked={f.enabled} onCheckedChange={(v) => set({ enabled: v })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
              <div className="space-y-2">
                <Label>SMTP host</Label>
                <Input placeholder="mail.yourdomain.com" value={f.host} onChange={(e) => set({ host: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input type="number" value={f.port} onChange={(e) => set({ port: Number(e.target.value) || 465 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Security</Label>
              <Select
                value={f.security}
                onValueChange={(v) => set({ security: v as Form["security"], port: v === "ssl" ? 465 : 587 })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ssl">SSL / TLS (port 465) — recommended</SelectItem>
                  <SelectItem value="starttls">STARTTLS (port 587)</SelectItem>
                  <SelectItem value="none">None (not recommended)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input autoComplete="off" placeholder="tickets@yourdomain.com" value={f.username} onChange={(e) => set({ username: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={q.data?.settings.hasPassword ? "•••••••• (saved — leave blank to keep)" : ""}
                  value={f.password}
                  onChange={(e) => set({ password: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>From name</Label>
                <Input value={f.from_name} onChange={(e) => set({ from_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>From email</Label>
                <Input type="email" placeholder="tickets@yourdomain.com" value={f.from_email} onChange={(e) => set({ from_email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reply-to (optional)</Label>
              <Input type="email" value={f.reply_to} onChange={(e) => set({ reply_to: e.target.value })} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Accept self-signed certificates</p>
                <p className="text-xs text-muted-foreground">Turn on if your shared host (cPanel etc.) gives certificate errors.</p>
              </div>
              <Switch checked={f.allow_self_signed} onCheckedChange={(v) => set({ allow_self_signed: v })} />
            </div>
            <Button onClick={save} disabled={!!busy} className="w-full sm:w-auto">
              {busy === "save" ? "Saving…" : "Save settings"}
            </Button>
          </section>

          <section className="surface-panel space-y-3 rounded-xl border border-border/70 p-5 sm:p-6">
            <p className="font-semibold">Send a test email</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <Button onClick={test} disabled={!!busy || !testTo}>
                <Send className="h-4 w-4" /> {busy === "test" ? "Sending…" : "Send test"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Save your settings first. Port 25 is blocked; use 465 or 587.</p>
          </section>

          <section className="surface-panel rounded-xl border border-border/70 p-5 sm:p-6">
            <p className="mb-3 font-semibold">Recent emails</p>
            {!q.data?.log.length ? (
              <p className="text-sm text-muted-foreground">No emails yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {q.data.log.map((l) => (
                  <li key={l.id} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.subject ?? l.kind}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.recipient} · {new Date(l.created_at).toLocaleString()}
                      </p>
                      {l.error && <p className="truncate text-xs text-destructive" title={l.error}>{l.error}</p>}
                    </div>
                    <Badge variant={l.status === "sent" ? "default" : l.status === "failed" ? "destructive" : "secondary"}>
                      {l.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
