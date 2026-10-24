import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DoorOpen, KeyRound, Loader2, LogOut, ScanLine } from "lucide-react";
import { Logo } from "@/components/brand";
import { TicketScanner } from "@/components/ticket-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { admission, gateStore, type GateInfo } from "@/lib/admission";
import { formatEventDate } from "@/lib/format";

export const Route = createFileRoute("/gate")({
  head: () => ({
    meta: [
      { title: "Gate admission — Usikose360" },
      {
        name: "description",
        content: "Door staff: enter the email and secret code from your event host to scan and admit guests.",
      },
      { property: "og:title", content: "Gate admission — Usikose360" },
      { property: "og:description", content: "Scan tickets at the door with a host-issued gate pass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Gate,
});

function Gate() {
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<GateInfo | null>(null);
  const [checking, setChecking] = useState(true);

  async function load(t: string) {
    const r = await admission.gateInfo(t).catch(() => ({ ok: false as const }));
    if (r.ok) {
      setToken(t);
      setInfo(r as GateInfo);
    } else {
      gateStore.clear();
      setToken(null);
      setInfo(null);
    }
  }

  useEffect(() => {
    const t = gateStore.get();
    if (t) load(t).finally(() => setChecking(false));
    else setChecking(false);
  }, []);

  async function logout() {
    if (token) await admission.gateLogout(token).catch(() => {});
    gateStore.clear();
    setToken(null);
    setInfo(null);
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token || !info) {
    return <GateLogin onIn={(t) => { gateStore.set(t); load(t); }} />;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
        <Logo />
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            {info.label} · {info.email}
          </span>
          <Button size="sm" variant="ghost" onClick={logout}>
            <LogOut className="h-4 w-4" /> Leave
          </Button>
        </div>
      </header>
      <TicketScanner
        title={info.event_title}
        subtitle={`${formatEventDate(info.starts_at)} · ${[info.venue, info.city].filter(Boolean).join(", ")}`}
        admitted={info.admitted}
        total={info.total}
        onCheck={async (code, undo) => {
          const r = await admission.gateAdmit(token, code, undo);
          if (r.result === "expired") {
            toast.error("Your gate pass was turned off or expired. Ask the host for a new code.");
            logout();
            return r;
          }
          load(token);
          return r;
        }}
        footer={
          <p className="mt-6 text-center text-xs text-muted-foreground">
            You've admitted <strong className="text-foreground">{info.mine}</strong> guest{info.mine === 1 ? "" : "s"} with
            this pass.
          </p>
        }
      />
    </div>
  );
}

function GateLogin({ onIn }: { onIn: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await admission.gateLogin(email, code);
      if (!r.ok) setError(r.error);
      else {
        toast.success(`Welcome to ${r.event_title}`);
        onIn(r.token);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <Link to="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <DoorOpen className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">Gate admission</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the email and secret code your event host gave you. No account needed.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gate-email">Email</Label>
              <Input
                id="gate-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gate@yourevent.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gate-code">Secret code</Label>
              <Input
                id="gate-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono tracking-[0.3em]"
                autoCapitalize="characters"
                autoComplete="one-time-code"
                placeholder="K7QM2XPA"
              />
            </div>
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Open scanner
            </Button>
          </form>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ScanLine className="h-3.5 w-3.5" /> Have an account on the admission team?{" "}
          <Link to="/admit" className="font-medium text-primary hover:underline">
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
