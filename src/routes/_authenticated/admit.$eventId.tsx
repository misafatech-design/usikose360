import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { TicketScanner } from "@/components/ticket-scanner";
import { supabase } from "@/integrations/supabase/client";
import { admission } from "@/lib/admission";

export const Route = createFileRoute("/_authenticated/admit/$eventId")({
  head: () => ({
    meta: [
      { title: "Scan tickets — Usikose360" },
      { name: "description", content: "Scan QR tickets and admit guests at the gate." },
      { property: "og:title", content: "Scan tickets — Usikose360" },
      { property: "og:description", content: "Gate admission scanner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admit,
});

function Admit() {
  const { eventId } = Route.useParams();

  const event = useQuery({
    queryKey: ["admit-event", eventId],
    queryFn: async () => (await supabase.from("events").select("title, venue, city").eq("id", eventId).single()).data,
  });
  const stats = useQuery({
    queryKey: ["admit-stats", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("checked_in_at").eq("event_id", eventId);
      const all = data ?? [];
      return { total: all.length, in: all.filter((t) => t.checked_in_at).length };
    },
  });
  const refetch = stats.refetch;

  useEffect(() => {
    const ch = supabase
      .channel(`admit-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `event_id=eq.${eventId}` }, () =>
        refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [eventId, refetch]);

  return (
    <TicketScanner
      title={event.data?.title ?? "Admissions"}
      subtitle={event.data ? [event.data.venue, event.data.city].filter(Boolean).join(", ") : undefined}
      admitted={stats.data?.in ?? 0}
      total={stats.data?.total ?? 0}
      onCheck={async (code, undo) => {
        const r = await admission.admit(eventId, code, undo);
        refetch();
        return r;
      }}
    />
  );
}
