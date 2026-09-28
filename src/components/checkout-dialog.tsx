import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Minus, Plus, RotateCcw, Smartphone, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { formatKes, isValidMpesaPhone } from "@/lib/format";
import { getOrderStatus, getPaymentMode, startCheckout } from "@/lib/mpesa.functions";

export type CheckoutTicketType = {
  id: string;
  name: string;
  price_kes: number;
  event_id: string;
  description?: string | null;
  remaining?: number;
};

type Person = { name: string; email: string; phone: string };
type Stage = "select" | "form" | "waiting" | "success" | "failed";
const TIMEOUT_MS = 90_000;

export function CheckoutDialog({
  open,
  onOpenChange,
  ticketTypes,
  initialTicketId,
  eventTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketTypes: CheckoutTicketType[];
  initialTicketId?: string | null;
  eventTitle: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const start = useServerFn(startCheckout);
  const status = useServerFn(getOrderStatus);
  const modeFn = useServerFn(getPaymentMode);
  const mode = useQuery({ queryKey: ["payment-mode"], queryFn: () => modeFn(), staleTime: 60_000 });

  const [qty, setQty] = useState<Record<string, number>>({});
  const [phone, setPhone] = useState("");
  const [buyer, setBuyer] = useState<Person>({ name: "", email: "", phone: "" });
  const [separate, setSeparate] = useState(false);
  const [others, setOthers] = useState<Person[]>([]);
  const [stage, setStage] = useState<Stage>("select");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (open) {
      setQty(initialTicketId ? { [initialTicketId]: 1 } : {});
      setBuyer((b) => ({ ...b, email: b.email || user?.email || "" }));
    } else {
      setStage("select");
      setOrderId(null);
      setMessage("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll until the callback marks the order paid/failed
  useEffect(() => {
    if (stage !== "waiting" || !orderId) return;
    let cancelled = false;
    let tick = 0;
    const loop = async () => {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 3000));
        if (cancelled) return;
        tick++;
        const elapsed = Date.now() - startedAt.current;
        try {
          // After ~20s, also ask Safaricom directly in case the callback is delayed
          const res = await status({ data: { orderId, query: elapsed > 20_000 && tick % 3 === 0 } });
          if (res.status === "paid") {
            setStage("success");
            setMessage(res.mpesa_receipt ? `Receipt ${res.mpesa_receipt}` : "");
            return;
          }
          if (res.status === "failed") {
            setStage("failed");
            setMessage(res.result_desc || "Payment was not completed");
            return;
          }
        } catch {
          /* keep polling */
        }
        if (elapsed > TIMEOUT_MS) {
          setStage("failed");
          setMessage("We didn't get a response from M-Pesa in time. You can try again.");
          return;
        }
      }
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [stage, orderId, status]);

  const lines = ticketTypes
    .map((t) => ({ t, q: qty[t.id] ?? 0 }))
    .filter((l) => l.q > 0);
  const count = lines.reduce((s, l) => s + l.q, 0);
  const total = lines.reduce((s, l) => s + l.q * Number(l.t.price_kes), 0);
  const seats = lines.flatMap((l) => Array.from({ length: l.q }, () => l.t.name));
  const others2 = seats.slice(1).map((_, i) => others[i] ?? { name: "", email: "", phone: "" });

  function setQ(id: string, v: number, max: number) {
    setQty((p) => ({ ...p, [id]: Math.max(0, Math.min(v, max, 20)) }));
  }

  function toInfo() {
    if (!user) {
      onOpenChange(false);
      navigate({ to: "/auth" });
      return;
    }
    if (count === 0) return toast.error("Choose at least one ticket");
    if (count > 20) return toast.error("Up to 20 tickets per order");
    setStage("form");
  }

  const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const live = mode.data?.live && total > 0;

  async function pay(retry = false) {
    if (!user) {
      onOpenChange(false);
      navigate({ to: "/auth" });
      return;
    }
    if (!buyer.name.trim() || !emailOk(buyer.email)) {
      toast.error("Enter your full name and a valid email");
      return;
    }
    if (separate && others2.some((o) => !o.name.trim() || !emailOk(o.email))) {
      toast.error("Enter a name and valid email for every attendee");
      return;
    }
    const payPhone = phone || buyer.phone;
    if (total > 0 && !isValidMpesaPhone(payPhone)) {
      toast.error("Enter a valid Kenyan phone number, e.g. 0712345678");
      return;
    }
    setBusy(true);
    try {
      const res = await start({
        data: {
          eventId: ticketTypes[0]!.event_id,
          items: lines.map((l) => ({ ticketTypeId: l.t.id, quantity: l.q })),
          buyer: { name: buyer.name.trim(), email: buyer.email.trim(), phone: buyer.phone.trim() },
          attendees: separate
            ? others2.map((o) => ({ name: o.name.trim(), email: o.email.trim(), phone: o.phone.trim() }))
            : [],
          phone: payPhone || "0700000000",
          orderId: retry && orderId ? orderId : undefined,
        },
      });
      setOrderId(res.orderId);
      if (res.mode === "instant") {
        setStage("success");
        setMessage("");
      } else {
        startedAt.current = Date.now();
        setStage("waiting");
      }
    } catch (err) {
      if (!phone) setPhone(payPhone);
      setStage(orderId ? "failed" : "form");
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      if (orderId) setMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (stage === "waiting" ? null : onOpenChange(v))}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {stage === "select" ? "Select tickets" : stage === "form" ? "Step 1: Customer information" : total > 0 ? "Pay with M-Pesa" : "Your tickets"}
          </DialogTitle>
          <DialogDescription>{eventTitle}</DialogDescription>
        </DialogHeader>

        {stage === "select" && (
          <div className="space-y-3">
            {ticketTypes.map((t) => {
              const max = t.remaining ?? 20;
              const q = qty[t.id] ?? 0;
              return (
                <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="text-sm text-primary">{formatKes(Number(t.price_kes))}</p>
                    {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    {max <= 0 && <p className="text-xs text-destructive">Sold out</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={q <= 0} onClick={() => setQ(t.id, q - 1, max)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center font-semibold">{q}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={q >= max} onClick={() => setQ(t.id, q + 1, max)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3 text-sm">
              <span className="text-muted-foreground">{count} ticket{count === 1 ? "" : "s"}</span>
              <span className="text-base font-semibold">{formatKes(total)}</span>
            </div>
            <Button className="w-full" onClick={toInfo} disabled={count === 0}>
              Checkout
            </Button>
          </div>
        )}

        {stage === "form" && (
          <div className="space-y-5">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide">Customer information</h3>
                <p className="text-xs text-muted-foreground">We'll send your tickets to this email address.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-name">Full name</Label>
                <Input id="b-name" maxLength={100} value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-email">Email</Label>
                <Input id="b-email" type="email" maxLength={255} value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-phone">Mobile Number</Label>
                <Input id="b-phone" inputMode="tel" placeholder="0712 345 678" maxLength={15} value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} />
              </div>
            </section>

            {count > 1 && (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide">Attendee details</h3>
                  <p className="text-xs text-muted-foreground">
                    Primary buyer receives the full ticket group. Other attendees will receive their individual tickets.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" variant={!separate ? "default" : "outline"} onClick={() => setSeparate(false)}>
                    All under my name
                  </Button>
                  <Button type="button" size="sm" variant={separate ? "default" : "outline"} onClick={() => setSeparate(true)}>
                    Different names
                  </Button>
                </div>
                {separate &&
                  others2.map((o, i) => {
                    const upd = (patch: Partial<Person>) =>
                      setOthers(others2.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <div key={i} className="space-y-2 rounded-xl border border-border p-3">
                        <p className="text-sm font-semibold">
                          Attendee {i + 2} <span className="font-normal text-muted-foreground">· {seats[i + 1]}</span>
                        </p>
                        <Input placeholder="Full name" maxLength={100} value={o.name} onChange={(e) => upd({ name: e.target.value })} />
                        <Input placeholder="Email" type="email" maxLength={255} value={o.email} onChange={(e) => upd({ email: e.target.value })} />
                        <Input placeholder="Mobile Number" inputMode="tel" maxLength={15} value={o.phone} onChange={(e) => upd({ phone: e.target.value })} />
                      </div>
                    );
                  })}
              </section>
            )}

            {total > 0 && (
              <div className="space-y-2">
                <Label htmlFor="phone">M-Pesa number to pay with</Label>
                <Input id="phone" inputMode="tel" placeholder={buyer.phone || "0712 345 678"} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} />
              </div>
            )}

            <section className="space-y-2 rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide">Order summary</h3>
              {lines.map((l) => (
                <div key={l.t.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{l.q} × {l.t.name}</span>
                  <span>{formatKes(l.q * Number(l.t.price_kes))}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>TOTAL KES</span>
                <span>{formatKes(total)}</span>
              </div>
            </section>
            {total > 0 && !mode.data?.live && !mode.isLoading && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-muted-foreground">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                M-Pesa isn't switched on yet, so this confirms your order without charging.
              </p>
            )}
            {live && mode.data?.environment === "sandbox" && (
              <p className="text-xs text-muted-foreground">Test mode (sandbox) — no real money moves.</p>
            )}
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <Button variant="outline" onClick={() => setStage("select")} disabled={busy}>Back</Button>
              <Button onClick={() => pay(false)} disabled={busy}>
                {busy ? "Sending…" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {stage === "waiting" && (
          <div className="space-y-4 py-4 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-glow" />
            <p className="font-semibold">Check your phone</p>
            <p className="text-sm text-muted-foreground">
              Enter your M-Pesa PIN on the prompt sent to {phone || buyer.phone}. We'll confirm automatically.
            </p>
          </div>
        )}

        {stage === "success" && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary-glow" />
            <p className="font-semibold">Payment confirmed — your tickets are ready!</p>
            {message && <p className="text-xs text-muted-foreground">{message}</p>}
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate({ to: "/tickets" });
              }}
            >
              View my tickets
            </Button>
          </div>
        )}

        {stage === "failed" && (
          <div className="space-y-4 py-4 text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="font-semibold">Payment not completed</p>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <div className="space-y-2 text-left">
              <Label htmlFor="phone2">M-Pesa phone number</Label>
              <Input id="phone2" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} />
            </div>
            <Button className="w-full" onClick={() => pay(true)} disabled={busy}>
              <RotateCcw className="h-4 w-4" /> {busy ? "Sending…" : "Retry payment"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
