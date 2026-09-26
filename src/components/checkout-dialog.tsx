import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Smartphone } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatKes, isValidMpesaPhone, normalizeMpesaPhone } from "@/lib/format";

export type CheckoutTicketType = {
  id: string;
  name: string;
  price_kes: number;
  event_id: string;
};

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
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ticketType) return null;
  const total = Number(ticketType.price_kes) * quantity;

  async function pay() {
    if (!user) {
      onOpenChange(false);
      navigate({ to: "/auth" });
      return;
    }
    if (!isValidMpesaPhone(phone)) {
      toast.error("Enter a valid Kenyan phone number, e.g. 0712345678");
      return;
    }
    setBusy(true);
    try {
      const tt = ticketType!;
      const reference = `USK-${Date.now().toString(36).toUpperCase()}`;
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          buyer_id: user.id,
          event_id: tt.event_id,
          ticket_type_id: tt.id,
          quantity,
          total_kes: total,
          buyer_email: user.email ?? null,
          mpesa_phone: normalizeMpesaPhone(phone),
          mpesa_reference: reference,
          status: "paid",
        })
        .select()
        .single();
      if (error) throw error;

      const rows = Array.from({ length: quantity }, () => ({
        order_id: order.id,
        event_id: tt.event_id,
        ticket_type_id: tt.id,
        holder_id: user.id,
      }));
      const { error: ticketError } = await supabase.from("tickets").insert(rows);
      if (ticketError) throw ticketError;

      toast.success("Tickets confirmed! Check My tickets.");
      onOpenChange(false);
      navigate({ to: "/tickets" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay with M-Pesa</DialogTitle>
          <DialogDescription>
            {ticketType.name} · {eventTitle}
          </DialogDescription>
        </DialogHeader>

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

          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-secondary/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="text-base font-semibold">{formatKes(total)}</span>
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-muted-foreground">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            M-Pesa isn't connected yet, so this confirms your order without charging. Add your
            Daraja details and real payment prompts go live on this same screen.
          </p>

          <Button className="w-full" onClick={pay} disabled={busy}>
            {busy ? "Processing…" : `Pay ${formatKes(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
