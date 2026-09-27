import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, Coins, Ticket, Users } from "lucide-react";
import { StaffPanel } from "@/components/staff-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatEventDate, formatKes } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/manage/$eventId")({
  head: () => ({
    meta: [
      { title: "Manage event — Usikose360" },
      {
        name: "description",
        content: "Track attendance, check in guests and follow ticket sales in real time.",
      },
      { property: "og:title", content: "Manage event — Usikose360" },
      { property: "og:description", content: "Real-time attendee tracking and check-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManageEvent,
});

function ManageEvent() {
  const { eventId } = Route.useParams();

  const event = useQuery({
    queryKey: ["manage-event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, ticket_types(*)")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const tickets = useQuery({
    queryKey: ["manage-tickets", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, code, checked_in_at, created_at, ticket_types(name), orders(total_kes)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `event_id=eq.${eventId}` },
        () => {
          tickets.refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, tickets]);

  const rows = tickets.data ?? [];
  const checkedIn = rows.filter((t) => t.checked_in_at).length;
  const revenue = rows.reduce((sum, t) => sum + Number(t.orders?.total_kes ?? 0), 0);

  async function toggleCheckIn(id: string, isIn: boolean) {
    const { error } = await supabase
      .from("tickets")
      .update({ checked_in_at: isIn ? null : new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Could not update check-in");
      return;
    }
    toast.success(isIn ? "Check-in undone" : "Guest checked in");
    tickets.refetch();
  }

  async function publish() {
    const { error } = await supabase
      .from("events")
      .update({ status: "published" })
      .eq("id", eventId);
    if (error) {
      toast.error("Could not publish");
      return;
    }
    toast.success("Event published");
    event.refetch();
  }

  return (
    <div className="">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {event.isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-extrabold">{event.data?.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.data ? formatEventDate(event.data.starts_at) : ""} · {event.data?.city}
              </p>
            </div>
            {event.data?.status === "published" ? (
              <Badge className="shrink-0">Published</Badge>
            ) : (
              <Button className="shrink-0" onClick={publish}>
                Publish
              </Button>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Ticket, label: "Tickets issued", value: String(rows.length) },
            { icon: Users, label: "Checked in", value: `${checkedIn}/${rows.length}` },
            { icon: Coins, label: "Revenue", value: formatKes(revenue) },
          ].map((k) => (
            <div key={k.label} className="surface-panel rounded-xl border border-border/70 p-5">
              <k.icon className="h-5 w-5 text-primary-glow" />
              <p className="mt-3 text-sm text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-bold">{k.value}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-bold">Attendees</h2>
        <div className="mt-4 space-y-2">
          {rows.length === 0 && (
            <div className="surface-panel rounded-xl border border-border/70 p-8 text-center text-sm text-muted-foreground">
              No tickets sold yet.
            </div>
          )}
          {rows.map((t) => (
            <div
              key={t.id}
              className="surface-panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold tracking-widest">
                  {t.code}
                </p>
                <p className="text-xs text-muted-foreground">{t.ticket_types?.name}</p>
              </div>
              <Button
                size="sm"
                variant={t.checked_in_at ? "secondary" : "default"}
                className="shrink-0"
                onClick={() => toggleCheckIn(t.id, !!t.checked_in_at)}
              >
                <CheckCircle2 className="h-4 w-4" />
                {t.checked_in_at ? "Checked in" : "Check in"}
              </Button>
            </div>
          ))}
        </div>

        <StaffPanel eventId={eventId} />
      </div>
    </div>
  );
}
