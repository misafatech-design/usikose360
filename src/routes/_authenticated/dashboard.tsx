import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarPlus, Coins, Ticket, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatEventDate, formatKes } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Usikose360" },
      {
        name: "description",
        content: "Track ticket sales, revenue and attendance for your Usikose360 events.",
      },
      { property: "og:title", content: "Organizer dashboard — Usikose360" },
      { property: "og:description", content: "Live sales and attendance analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard;
});

function Dashboard() {
  const { user, isOrganizer } = useAuth();

  const events = useQuery({
    queryKey: ["organizer-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, ticket_types(id,name,price_kes,quantity,sold)")
        .eq("organizer_id", user!.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const orders = useQuery({
    queryKey: ["organizer-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,total_kes,quantity,status,created_at,event_id,events(title)")
        .eq("status", "paid")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        orders.refetch();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orders]);

  const paid = orders.data ?? [];
  const revenue = paid.reduce((sum, o) => sum + Number(o.total_kes), 0);
  const ticketsSold = paid.reduce((sum, o) => sum + o.quantity, 0);

  const chartData = Object.values(
    paid.reduce<Record<string, { name: string; revenue: number }>>((acc, o) => {
      const name = o.events?.title ?? "Event";
      acc[o.event_id] = acc[o.event_id] ?? { name, revenue: 0 };
      acc[o.event_id]!.revenue += Number(o.total_kes);
      return acc;
    }, {}),
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-extrabold">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sales, revenue and attendance across your events.
            </p>
          </div>
          {isOrganizer && (
            <Button asChild className="shrink-0">
              <Link to="/events/new">
                <CalendarPlus className="h-4 w-4" /> Create event
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Coins, label: "Revenue", value: formatKes(revenue) },
            { icon: Ticket, label: "Tickets sold", value: String(ticketsSold) },
            { icon: Users, label: "Events", value: String((events.data ?? []).length) },
          ].map((k) => (
            <div key={k.label} className="surface-panel rounded-xl border border-border/70 p-5">
              <k.icon className="h-5 w-5 text-primary-glow" />
              <p className="mt-3 text-sm text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-bold">{k.value}</p>
            </div>
          ))}
        </div>

        {chartData.length > 0 && (
          <div className="surface-panel mt-6 rounded-xl border border-border/70 p-5">
            <h2 className="text-lg font-semibold">Revenue by event</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" />
                  <YAxis tick={{ fontSize: 11 }} stroke="currentColor" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                    }}
                  />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <h2 className="mt-10 text-xl font-bold">Your events</h2>
        <div className="mt-4 space-y-3">
          {events.isLoading && <Skeleton className="h-24 rounded-xl" />}
          {!events.isLoading && (events.data ?? []).length === 0 && (
            <div className="surface-panel rounded-xl border border-border/70 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                You haven't created any events yet.
              </p>
              <Button asChild className="mt-4">
                <Link to="/events/new">Create your first event</Link>
              </Button>
            </div>
          )}
          {(events.data ?? []).map((e) => (
            <Link
              key={e.id}
              to="/manage/$eventId"
              params={{ eventId: e.id }}
              className="surface-panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border/70 p-5 transition hover:border-primary/60"
            >
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{e.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatEventDate(e.starts_at)} · {e.city}
                </p>
              </div>
              <Badge variant={e.status === "published" ? "default" : "secondary"}>
                {e.status}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
