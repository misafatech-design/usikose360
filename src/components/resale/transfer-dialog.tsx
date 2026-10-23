import { useState } from "react";
import { toast } from "sonner";
import { Gift, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notice, resale } from "@/lib/resale";

export function TransferDialog({
  open,
  onOpenChange,
  ticketId,
  eventTitle,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  eventTitle: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await resale.gift(ticketId, email.trim(), name.trim(), note.trim());
      notice("gift", ticketId);
      toast.success(`Ticket sent to ${email.trim()}`, { description: "They'll get it by email with a new QR code." });
      onOpenChange(false);
      setName("");
      setEmail("");
      setNote("");
      setConfirm(false);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const valid = name.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setConfirm(false); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" /> Transfer ticket
          </DialogTitle>
          <DialogDescription>
            Send your {eventTitle} ticket to a friend. They get a brand-new QR code and your current code stops working.
          </DialogDescription>
        </DialogHeader>
        {!confirm ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tr-name">Recipient name</Label>
              <Input id="tr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Jane Wanjiku" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-email">Recipient email</Label>
              <Input id="tr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="jane@example.com" />
              <p className="text-xs text-muted-foreground">No account? We'll create one for them automatically.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-note">Message (optional)</Label>
              <Textarea id="tr-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} placeholder="See you there!" />
            </div>
            <Button className="w-full" disabled={!valid} onClick={() => setConfirm(true)}>
              Continue
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
              <p>
                You're giving this ticket to <strong>{name}</strong> ({email}).
              </p>
              <p className="mt-2 text-muted-foreground">This can't be undone. Only they will be able to transfer it back.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>
                Back
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send ticket
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
