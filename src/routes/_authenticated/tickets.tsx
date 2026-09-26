import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import QRCode from "react-qr-code";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatEventDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({
    meta: [
      { title: "My tickets — Usikose360" },
      { name: "description", content: "All the event tickets you have bought on Usikose360." },
      { property: "og:title", content: "My tickets — Usikose360" },
      { property: "og:description", content: "Your e-tickets, ready at the gate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyTickets,
});

function MyTickets() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, code, checked_in_at, created_at, events(*), ticket_types(name)")
        .eq("holder_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-extrabold">My tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Show the code at the gate. Show the QR code at the gate to be admitted.
        </p>

        <div className="mt-8 space-y-4">
          {isLoading && <Skeleton className="h-32 rounded-xl" />}
          {!isLoading && (data ?? []).length === 0 && (
            <div className="surface-panel rounded-xl border border-border/70 p-10 text-center">
              <p className="text-sm text-muted-foreground">You have no tickets yet.</p>
              <Button asChild className="mt-4">
                <Link to="/">Find an event</Link>
              </Button>
            </div>
          )}
          {(data ?? []).map((t) => (
            <div
              key={t.id}
              className="surface-panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border/70 p-5"
            >
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{t.events?.title}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {t.events ? formatEventDate(t.events.starts_at) : ""}
                </p>
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {t.events?.venue ? `${t.events.venue}, ${t.events.city}` : t.events?.city}
                  </span>
                </p>
                <Badge variant="secondary" className="mt-3">
                  {t.ticket_types?.name}
                </Badge>
              </div>
              <div className="shrink-0 text-center">
                <div className="rounded-lg bg-foreground p-2">
                  <QRCode value={t.code} size={96} bgColor="transparent" fgColor="hsl(var(--background))" />
                </div>
                <p className="mt-2 font-mono text-sm font-semibold tracking-widest">{t.code}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.checked_in_at ? "Checked in" : "Valid"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
