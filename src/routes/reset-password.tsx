import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Search = { token_hash?: string | undefined; type?: string | undefined; setup?: string | undefined };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token_hash: typeof s["token_hash"] === "string" ? (s["token_hash"] as string) : undefined,
    type: typeof s["type"] === "string" ? (s["type"] as string) : undefined,
    setup: s["setup"] ? String(s["setup"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Choose a new password — Usikose360" },
      { name: "description", content: "Set a new password for your Usikose360 account." },
      { property: "og:title", content: "Choose a new password — Usikose360" },
      { property: "og:description", content: "Finish resetting your Usikose360 password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token_hash, setup } = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: "recovery" });
        if (!cancelled) setState(error ? "invalid" : "ready");
      } else {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setState(data.session ? "ready" : "invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token_hash]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    if (pw !== pw2) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw, data: { needs_password: false } });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password saved");
    navigate({ to: "/tickets" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="surface-panel w-full max-w-md rounded-2xl border border-border/70 p-7">
        <Logo className="mb-6" />
        {state === "checking" && <p className="text-sm text-muted-foreground">Checking your link…</p>}
        {state === "invalid" && (
          <div className="space-y-3">
            <h1 className="text-2xl font-bold">Link expired</h1>
            <p className="text-sm text-muted-foreground">This link is invalid or has expired. Request a new one.</p>
            <Button asChild className="w-full"><Link to="/forgot-password">Send a new link</Link></Button>
          </div>
        )}
        {state === "ready" && (
          <>
            <h1 className="text-2xl font-bold">{setup ? "Set your password" : "Choose a new password"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {setup ? "Create a password to sign in and see your tickets any time." : "Enter a new password for your account."}
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">New password</Label>
                <Input id="pw" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">Confirm password</Label>
                <Input id="pw2" type="password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
