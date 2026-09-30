import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/email.functions";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — Usikose360" },
      { name: "description", content: "Reset the password for your Usikose360 account." },
      { property: "og:title", content: "Forgot password — Usikose360" },
      { property: "og:description", content: "Get a link to choose a new password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const send = useServerFn(requestPasswordReset);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send({ data: { email, origin: window.location.origin } });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="surface-panel w-full max-w-md rounded-2xl border border-border/70 p-7">
        <Logo className="mb-6" />
        {done ? (
          <div className="space-y-3 text-center">
            <MailCheck className="mx-auto h-12 w-12 text-primary" />
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for {email}, we've sent a link to reset your password. It expires in 1 hour.
            </p>
            <Button asChild variant="outline" className="w-full"><Link to="/auth">Back to sign in</Link></Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Forgot your password?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
            </form>
            <Link to="/auth" className="mt-5 block text-center text-sm text-muted-foreground hover:text-foreground">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
