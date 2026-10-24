import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, DoorOpen, KeyRound, Power, RefreshCw, ScanLine, Share2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { admission } from "@/lib/admission";

function gateUrl() {
  return typeof window !== "undefined" ? `${window.location.origin}/gate` : "/gate";
}

/** Admission team: staff accounts and account-free gate passes (email + secret code). */
export function StaffPanel({ eventId, eventTitle }: { eventId: string; eventTitle?: string }) {
  return (
    <div className="mt-10">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="text-xl font-bold">Admission team</h2>
        <Button asChild size="sm" variant="secondary">
          <Link to="/admit/$eventId" params={{ eventId }}>
            <ScanLine className="h-4 w-4" /> Open scanner
          </Link>
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Give door staff a gate pass (email + secret code, no account needed) or add someone who already has an account.
      </p>
      <Tabs defaultValue="passes" className="mt-4">
        <TabsList>
          <TabsTrigger value="passes">
            <KeyRound className="h-4 w-4" /> Gate passes
          </TabsTrigger>
          <TabsTrigger value="staff">
            <UserPlus className="h-4 w-4" /> Staff accounts
          </TabsTrigger>
        </TabsList>
        <TabsContent value="passes">
          <GatePasses eventId={eventId} eventTitle={eventTitle} />
        </TabsContent>
        <TabsContent value="staff">
          <StaffAccounts eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GatePasses({ eventId, eventTitle }: { eventId: string; eventTitle?: string }) {
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["gate-passes", eventId],
    queryFn: async () =>
      (
        await supabase
          .from("gate_passes")
          .select("id, label, email, secret_code, is_active, last_used_at, created_at")
          .eq("event_id", eventId)
          .order("created_at")
      ).data ?? [],
  });
  const counts = useQuery({
    queryKey: ["gate-pass-counts", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("gate_pass_id")
        .eq("event_id", eventId)
        .not("gate_pass_id", "is", null)
        .not("checked_in_at", "is", null);
      const m = new Map<string, number>();
      (data ?? []).forEach((t) => t.gate_pass_id && m.set(t.gate_pass_id, (m.get(t.gate_pass_id) ?? 0) + 1));
      return m;
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await admission.createPass(eventId, label, email, code);
      toast.success(`Gate pass ready — code ${r.code}`);
      setLabel("");
      setEmail("");
      setCode("");
      q.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(p: { label: string; email: string }) {
    try {
      const r = await admission.createPass(eventId, p.label, p.email);
      toast.success(`New code ${r.code}. The old code no longer works.`);
      q.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("gate_passes").update({ is_active: !active }).eq("id", id);
    if (error) toast.error("Could not update the pass");
    else toast.success(active ? "Pass turned off" : "Pass turned on");
    q.refetch();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("gate_passes").delete().eq("id", id);
    if (error) toast.error("Could not delete the pass");
    q.refetch();
  }

  function shareText(p: { email: string; secret_code: string; label: string }) {
    return `Gate pass for ${eventTitle ?? "our event"} (${p.label})\nOpen: ${gateUrl()}\nEmail: ${p.email}\nSecret code: ${p.secret_code}`;
  }

  async function share(p: { email: string; secret_code: string; label: string }) {
    const text = shareText(p);
    if (navigator.share) {
      navigator.share({ title: "Gate pass", text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Pass details copied");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <Input required placeholder="Name, e.g. Gate A — Brian" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
        <Input required type="email" placeholder="door@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          placeholder="Secret code (leave empty to generate)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="font-mono"
          maxLength={32}
        />
        <Button type="submit" disabled={busy}>
          <KeyRound className="h-4 w-4" /> Create gate pass
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Door staff open <span className="font-mono text-foreground">{gateUrl()}</span> and enter this email and code.
        </p>
      </form>
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No gate passes yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {q.data?.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.label}</p>
                <p className="truncate text-xs text-muted-foreground">{p.email}</p>
              </div>
              <Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "Active" : "Off"}</Badge>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(p.secret_code).then(() => toast.success("Code copied"))}
              className="mt-3 flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2 font-mono text-lg font-bold tracking-[0.25em]"
            >
              {p.secret_code}
              <Copy className="h-4 w-4 text-muted-foreground" />
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              <DoorOpen className="mr-1 inline h-3.5 w-3.5" />
              Admitted {counts.data?.get(p.id) ?? 0}
              {p.last_used_at ? ` · last scan ${new Date(p.last_used_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              <Button size="sm" variant="secondary" onClick={() => share(p)}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
              <Button size="sm" variant="ghost" onClick={() => regenerate(p)} title="New code">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggle(p.id, p.is_active)} title={p.is_active ? "Turn off" : "Turn on"}>
                <Power className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(p.id)} aria-label="Delete pass">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffAccounts({ eventId }: { eventId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["event-staff", eventId],
    queryFn: async () =>
      (await supabase.from("event_staff").select("id, email, role").eq("event_id", eventId)).data ?? [],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await admission.addStaff(eventId, email);
      toast.success("Admission staff added");
      setEmail("");
      q.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("event_staff").delete().eq("id", id);
    if (error) toast.error("Could not remove");
    q.refetch();
  }

  return (
    <div>
      <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input type="email" required placeholder="staff@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" disabled={busy}>
          <UserPlus className="h-4 w-4" /> Add
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">They sign in and find this event under Admissions.</p>
      <div className="mt-3 space-y-2">
        {q.data?.map((s) => (
          <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card px-4 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{s.email}</p>
              <p className="text-xs text-muted-foreground">Admission</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(s.id)} aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
