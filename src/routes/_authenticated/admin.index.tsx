import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Coins, Sparkles, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatEventDate, formatKes } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — Usikose360" },
      { name: "description", content: "Platform-wide sales, events and payments for administrators." },
      { property: "og:title", content: "Admin overview — Usikose360" },
      { property: "og:description", content: "Platform-wide sales and events at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const { isAdmin } = useAuth();
  const q = useQuery({
    queryKey: ["admin-overview"],
    enabled: isAdmin,
    queryFn: async () => {
      const [events, orders, tickets] = await Promise.all([
        supabase.from("events").select("id,title,status,is_featured,starts_at,city"),
        supabase
          .from("orders")
          .select("id,total_kes,status,created_at,quantity,events(title)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("tickets").select("id", { count: "exact", head: true }),
      ]);
      return {
        events: events.data ?? [],
        orders: orders.data ?? [],
        tickets: tickets.count ?? 0,
      };
    },
  });

  if (!isAdmin) {
    return <p className="p-10 text-center text-sm text-muted-foreground">Administrator access needed.</p>;
  }

  const paid = (q.data?.orders ?? []).filter((o) => o.status === "paid");
  const revenue = paid.reduce((s, o) => s + Number(o.total_kes), 0);
  const kpis = [
    { icon: Coins, label: "Revenue (recent)", value: formatKes(revenue) },
    { icon: Ticket, label: "Tickets issued", value: String(q.data?.tickets ?? 0) },
    { icon: CalendarDays, label: "Events", value: String(q.data?.events.length ?? 0) },
    {
      icon: Sparkles,
      label: "Featured",
      value: String(q.data?.events.filter((e) => e.is_featured).length ?? 0),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold sm:text-3xl">Admin overview</h1>
          <p className="text-sm text-muted-foreground">Everything happening on Usikose360.</p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/admin/events">Manage featured</Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="surface-panel rounded-xl border border-border p-4">
            <k.icon className="h-5 w-5 text-primary" />
            <p className="mt-2 text-xs text-muted-foreground">{k.label}</p>
            {q.isLoading ? <Skeleton className="mt-1 h-7 w-20" /> : <p className="text-xl font-bold">{k.value}</p>}
          </div>
        ))}
      </div>

      <div className="surface-panel mt-6 overflow-hidden rounded-xl border border-border">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Recent orders</h2>
        <div className="divide-y divide-border">
          {(q.data?.orders ?? []).slice(0, 12).map((o) => (
            <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{(o.events as { title?: string } | null)?.title ?? "Event"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatEventDate(o.created_at)} · {o.quantity} ticket(s)
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatKes(Number(o.total_kes))}</p>
                <Badge variant={o.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                  {o.status}
                </Badge>
              </div>
            </div>
          ))}
          {!q.isLoading && !q.data?.orders.length && (
            <p className="p-6 text-center text-sm text-muted-foreground">No orders yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
