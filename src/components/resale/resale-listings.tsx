import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BadgeCheck, Loader2, Lock, Repeat } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { formatKes, isValidMpesaPhone, normalizeMpesaPhone } from "@/lib/format";
import { notice, resale, type PublicListing } from "@/lib/resale";

export type ListingWithMeta = PublicListing & { type_name?: string | null; event_title?: string | null };

export function PriceTag({ price, face }: { price: number; face: number }) {
  const diff = face ? Math.round(((price - face) / face) * 100) : 0;
  return (
    <div className="text-right">
      <p className="text-lg font-bold leading-tight text-primary">{formatKes(price)}</p>
      {face > 0 && diff !== 0 && (
        <p className={`text-[11px] font-medium ${diff > 0 ? "text-warning" : "text-success"}`}>
          {diff > 0 ? `+${diff}%` : `${diff}%`} vs {formatKes(face)}
        </p>
      )}
      {face > 0 && diff === 0 && <p className="text-[11px] text-muted-foreground">Face value</p>}
    </div>
  );
}

export function ListingRow({ l, onBuy, showEvent }: { l: ListingWithMeta; onBuy: (l: ListingWithMeta) => void; showEvent?: boolean }) {
  const { user } = useAuth();
  const mine = user?.id === l.seller_id;
  const reserved = l.status === "reserved";
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          {showEvent && l.event_title && (
            <Link to="/events/$eventId" params={{ eventId: l.event_id }} className="block truncate text-sm font-semibold hover:text-primary">
              {l.event_title}
            </Link>
          )}
          <p className="truncate font-semibold">{l.type_name ?? "Ticket"}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <BadgeCheck className="h-3.5 w-3.5 text-primary" /> {l.seller_name ?? "Verified fan"}
          </p>
        </div>
        <PriceTag price={Number(l.price_kes)} face={Number(l.face_value_kes)} />
      </div>
      {l.note && <p className="mt-2 line-clamp-2 text-xs italic text-muted-foreground">“{l.note}”</p>}
      <Button
        size="sm"
        variant={mine || reserved ? "secondary" : "default"}
        className="mt-3 w-full"
        disabled={mine || reserved}
        onClick={() => onBuy(l)}
      >
        {mine ? "Your listing" : reserved ? (<><Lock className="h-3.5 w-3.5" /> Reserved</>) : "Buy from fan"}
      </Button>
    </div>
  );
}

export function BuyResaleDialog({ listing, onOpenChange }: { listing: ListingWithMeta | null; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState((user?.user_metadata?.["full_name"] as string) ?? "");
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!listing) return;
    setBusy(true);
    try {
      const tradeId = await resale.buy(listing.id, normalizeMpesaPhone(phone), name.trim());
      notice("reserved", tradeId);
      onOpenChange(false);
      toast.success("Ticket reserved for 30 minutes", { description: `Trade ${tradeId.slice(0, 8)}` });
      navigate({ to: "/tickets" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!listing} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" /> Buy from a fan
          </DialogTitle>
          <DialogDescription>
            {listing?.type_name ?? "Ticket"}
            {listing?.event_title ? ` · ${listing.event_title}` : ""} for {listing ? formatKes(Number(listing.price_kes)) : ""}
          </DialogDescription>
        </DialogHeader>
        {!user ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Sign in so the ticket can be moved safely into your account.</p>
            <Button asChild className="w-full">
              <Link to="/auth" search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/resale" } as never}>
                Sign in to buy
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <ol className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
              <li><strong>1.</strong> We hold the ticket for you for <strong>30 minutes</strong>.</li>
              <li><strong>2.</strong> You send the money to the seller's M-Pesa number and tap <em>I've paid</em>.</li>
              <li><strong>3.</strong> The seller releases it and you get a fresh QR code.</li>
            </ol>
            <div className="space-y-1.5">
              <Label htmlFor="buy-name">Name on the ticket</Label>
              <Input id="buy-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buy-phone">Your M-Pesa number</Label>
              <Input id="buy-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
            </div>
            <Button className="w-full" disabled={busy || !isValidMpesaPhone(phone) || name.trim().length < 2} onClick={start}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Reserve ticket
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Never pay before reserving. If something goes wrong after paying, open a dispute and an admin will step in.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ResaleBadge() {
  return (
    <Badge variant="secondary" className="gap-1">
      <Repeat className="h-3 w-3" /> Fan resale
    </Badge>
  );
}
