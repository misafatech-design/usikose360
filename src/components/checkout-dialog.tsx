import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw, Smartphone, XCircle } from "lucide-react";
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
};

type Stage = "form" | "waiting" | "success" | "failed";
const TIMEOUT_MS = 90_000;

export function CheckoutDialog({
  open,
  onOpenChange,
  ticketType,
  eventTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketType: CheckoutTicketType | null;
  eventTitle: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const start = useServerFn(startCheckout);
  const status = useServerFn(getOrderStatus);
  const modeFn = useServerFn(getPaymentMode);
  const mode = useQuery({ queryKey: ["payment-mode"], queryFn: () => modeFn(), staleTime: 60_000 });

  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!open) {
      setStage("form");
      setOrderId(null);
      setMessage("");
    }
  }, [open]);

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

  if (!ticketType) return null;
  const total = Number(ticketType.price_kes) * quantity;
  const live = mode.data?.live && total > 0;

  async function pay(retry = false) {
    if (!user) {
      onOpenChange(false);
      navigate({ to: "/auth" });
      return;
    }
    if (total > 0 && !isValidMpesaPhone(phone)) {
      toast.error("Enter a valid Kenyan phone number, e.g. 0712345678");
      return;
    }
    setBusy(true);
    try {
      const res = await start({
        data: {
          ticketTypeId: ticketType!.id,
          quantity,
          phone: phone || "0700000000",
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
      setStage(orderId ? "failed" : "form");
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      if (orderId) setMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (stage === "waiting" ? null : onOpenChange(v))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{total > 0 ? "Pay with M-Pesa" : "Get your ticket"}</DialogTitle>
          <DialogDescription>
            {ticketType.name} · {eventTitle}
          </DialogDescription>
        </DialogHeader>

        {stage === "form" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            {total > 0 && (
              <div className="space-y-2">
                <Label htmlFor="phone">M-Pesa phone number</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  placeholder="0712 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={15}
                />
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-secondary/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="text-base font-semibold">{formatKes(total)}</span>
            </div>
            {total > 0 && !mode.data?.live && !mode.isLoading && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-muted-foreground">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                M-Pesa isn't switched on yet, so this confirms your order without charging.
              </p>
            )}
            {live && mode.data?.environment === "sandbox" && (
              <p className="text-xs text-muted-foreground">Test mode (sandbox) — no real money moves.</p>
            )}
            <Button className="w-full" onClick={() => pay(false)} disabled={busy}>
              {busy ? "Sending…" : total > 0 ? `Pay ${formatKes(total)}` : "Confirm"}
            </Button>
          </div>
        )}

        {stage === "waiting" && (
          <div className="space-y-4 py-4 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-glow" />
            <p className="font-semibold">Check your phone</p>
            <p className="text-sm text-muted-foreground">
              Enter your M-Pesa PIN on the prompt sent to {phone}. We'll confirm automatically.
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
