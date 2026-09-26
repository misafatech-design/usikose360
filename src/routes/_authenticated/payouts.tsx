import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatKes } from "@/lib/format";
import { getPayoutSummary, requestPayout } from "@/lib/mpesa.functions";

export const Route = createFileRoute("/_authenticated/payouts")({
  head: () => ({
    meta: [
      { title: "Withdrawals — Usikose360" },
      { name: "description", content: "Withdraw your ticket sales to M-Pesa." },
      { property: "og:title", content: "Withdrawals — Usikose360" },
      { property: "og:description", content: "Organizer payouts straight to M-Pesa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Payouts,
});

function Payouts() {
  const fetchFn = useServerFn(getPayoutSummary);
  const withdraw = useServerFn(requestPayout);
  const q = useQuery({ queryKey: ["payouts"], queryFn: () => fetchFn() });
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("payouts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "payouts" }, () => q.refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [q]);

  async function submit() {
    setBusy(true);
    try {
      await withdraw({ data: { amount: Number(amount), phone } });
      toast.success("Withdrawal sent to M-Pesa");
      setAmount("");
      q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setBusy(false);
    }
  }

  const d = q.data;
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold">Withdrawals</h1>
        {!d ? (
          <Skeleton className="mt-8 h-48 rounded-xl" />
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["Paid ticket sales", d.earned],
                ["Withdrawn", d.withdrawn],
                ["Available", d.available],
              ].map(([l, v]) => (
                <div key={l as string} className="surface-panel rounded-xl border border-border/70 p-5">
                  <p className="text-sm text-muted-foreground">{l}</p>
                  <p className="text-2xl font-bold">{formatKes(v as number)}</p>
                </div>
              ))}
            </div>

            <div className="surface-panel mt-6 space-y-4 rounded-xl border border-border/70 p-5">
              <h2 className="text-lg font-semibold">Withdraw to M-Pesa</h2>
              {!d.payoutsEnabled && (
                <p className="text-sm text-muted-foreground">Withdrawals are not switched on yet by the administrator.</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="amt">Amount (KES)</Label>
                  <Input id="amt" type="number" min={10} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ph">M-Pesa phone</Label>
                  <Input id="ph" inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <Button onClick={submit} disabled={busy || !d.payoutsEnabled || !amount || !phone}>
                {busy ? "Sending…" : "Withdraw"}
              </Button>
            </div>

            <h2 className="mt-10 text-xl font-bold">History</h2>
            <div className="mt-4 space-y-2">
              {d.payouts.length === 0 && <p className="text-sm text-muted-foreground">No withdrawals yet.</p>}
              {d.payouts.map((p) => (
                <div key={p.id} className="surface-panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{formatKes(Number(p.amount_kes))}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleString("en-KE")} · {p.phone}
                      {p.mpesa_receipt ? ` · ${p.mpesa_receipt}` : ""}
                      {p.status === "failed" && p.result_desc ? ` · ${p.result_desc}` : ""}
                    </p>
                  </div>
                  <Badge variant={p.status === "completed" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
