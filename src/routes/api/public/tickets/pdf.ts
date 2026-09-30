import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tickets/pdf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const orderId = q.get("order");
        const token = q.get("token");
        const codes = (q.get("codes") ?? "")
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter((c) => /^[A-Z0-9]{6,20}$/.test(c))
          .slice(0, 20);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let query = supabaseAdmin
          .from("tickets")
          .select("code, attendee_name, created_at, ticket_types(name), events(title, starts_at, venue, city), orders!inner(status, access_token)")
          .eq("orders.status", "paid")
          .order("created_at");
        if (orderId && token && /^[0-9a-f-]{36}$/i.test(orderId)) {
          query = query.eq("order_id", orderId).eq("orders.access_token", token);
        } else if (codes.length) {
          query = query.in("code", codes);
        } else {
          return new Response("Not found", { status: 404 });
        }
        const { data } = await query;
        if (!data?.length) return new Response("Tickets not found", { status: 404 });

        const { ticketsPdf } = await import("@/lib/email/pdf.server");
        const bytes = await ticketsPdf(
          data.map((t: any) => ({
            code: t.code,
            type: t.ticket_types?.name ?? "Ticket",
            attendee: t.attendee_name,
            event: t.events,
          })),
        );
        return new Response(bytes, {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="usikose360-tickets.pdf"`,
            "cache-control": "private, no-store",
          },
        });
      },
    },
  },
});
