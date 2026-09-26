import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ScanLine, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { addEventStaff } from "@/lib/staff.functions";

export function StaffPanel({ eventId }: { eventId: string }) {
  const add = useServerFn(addEventStaff);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["event-staff", eventId],
    queryFn: async () =>
      (await supabase.from("event_staff").select("id, email, role").eq("event_id", eventId)).data ?? [],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await add({ data: { eventId, email } });
      toast.success("Admission staff added");
      setEmail("");
      q.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("event_staff").delete().eq("id", id);
    if (error) toast.error("Could not remove");
    q.refetch();
  }

  return (
    <div className="mt-10">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="text-xl font-bold">Admission team</h2>
        <Button asChild size="sm" variant="secondary">
          <Link to="/admit/$eventId" params={{ eventId }}>
            <ScanLine className="h-4 w-4" /> Open scanner
          </Link>
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        People you add can scan tickets and mark guests as attended for this event.
      </p>
      <form onSubmit={submit} className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input type="email" required placeholder="staff@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" disabled={busy}>
          <UserPlus className="h-4 w-4" /> Add
        </Button>
      </form>
      <div className="mt-3 space-y-2">
        {q.data?.map((s) => (
          <div key={s.id} className="surface-panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 px-4 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{s.email}</p>
              <p className="text-xs text-muted-foreground">Admission</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(s.id)} aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
