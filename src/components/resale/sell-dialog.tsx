import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Tag, TrendingDown, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatKes, isValidMpesaPhone, normalizeMpesaPhone } from "@/lib/format";
import { resale, resaleCap } from "@/lib/resale";

export function SellDialog({
  open,
  onOpenChange,
  ticketId,
  eventTitle,
  faceValue,
  markupPct,
  existing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  eventTitle: string;
  faceValue: number;
  markupPct: number | null;
  existing?: { id: string; price_kes: number; note: string | null } | null;
  onDone: () => void;
}) {
  const cap = resaleCap(faceValue, markupPct);
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrice(existing ? String(Number(existing.price_kes)) : faceValue ? String(faceValue) : "");
    setNote(existing?.note ?? "");
  }, [open, existing, faceValue]);

  const n = Number(price);
  const diff = faceValue ? Math.round(((n - faceValue) / faceValue) * 100) : 0;
  const overCap = cap != null && n > cap;
  const valid = n >= 10 && !overCap && (existing || isValidMpesaPhone(phone));

  const suggestions = faceValue
    ? [
        { label: "Face value", value: faceValue },
        { label: "-10%", value: Math.round(faceValue * 0.9) },
        { label: "+20%", value: Math.round(faceValue * 1.2) },
      ].filter((s) => cap == null || s.value <= cap)
    : [];

  async function submit() {
    setBusy(true);
    try {
      if (existing) {
        await resale.update(existing.id, n, note.trim());
        toast.success("Listing updated");
      } else {
        await resale.list(ticketId, n, normalizeMpesaPhone(phone), note.trim());
        toast.success("Your ticket is on the resale market", { description: "We'll email you when a buyer reserves it." });
      }
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> {existing ? "Edit listing" : "Sell on fan resale"}
          </DialogTitle>
          <DialogDescription>
            Set your own price for {eventTitle}. Buyers pay you directly by M-Pesa and you release the ticket once the money arrives.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sell-price">Your price (KES)</Label>
            <Input
              id="sell-price"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              className="h-12 text-lg font-semibold"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {faceValue > 0 && (
                <span className="text-muted-foreground">Face value {formatKes(faceValue)}</span>
              )}
              {faceValue > 0 && n > 0 && diff !== 0 && (
                <span className={`inline-flex items-center gap-1 font-medium ${diff > 0 ? "text-warning" : "text-success"}`}>
                  {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {diff > 0 ? "+" : ""}
                  {diff}%
                </span>
              )}
              {cap != null && <span className="text-muted-foreground">· Organizer max {formatKes(cap)}</span>}
            </div>
            {overCap && <p className="text-xs text-destructive">Above the organizer's price cap.</p>}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((s) => (
                  <Button key={s.label} type="button" size="sm" variant="secondary" onClick={() => setPrice(String(s.value))}>
                    {s.label} · {formatKes(s.value)}
                  </Button>
                ))}
              </div>
            )}
          </div>
          {!existing && (
            <div className="space-y-1.5">
              <Label htmlFor="sell-phone">M-Pesa number to receive payment</Label>
              <Input id="sell-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
              <p className="text-xs text-muted-foreground">Only shown to a buyer after they reserve your ticket.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="sell-note">Note to buyers (optional)</Label>
            <Textarea id="sell-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} placeholder="Can't make it anymore — have fun!" />
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            While listed, the ticket can't be scanned at the gate. When it sells, the buyer gets a new QR code and yours stops working.
          </div>
          <Button className="w-full" disabled={!valid || busy} onClick={submit}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {existing ? "Save changes" : `List for ${n ? formatKes(n) : "…"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
