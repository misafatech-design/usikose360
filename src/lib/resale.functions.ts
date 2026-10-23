import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Transfers and trades run as database functions called from the browser, so they work on any host.
 * This server function only sends the follow-up emails, after checking the caller took part.
 */
export const sendResaleNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["gift", "reserved", "paid", "released", "disputed", "cancelled"]),
        id: z.string().uuid(),
        origin: z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requestOrigin } = await import("./origin.server");
    const origin = requestOrigin(data.origin);
    try {
      if (data.kind === "gift") {
        // id = ticket id; find the caller's most recent transfer of it
        const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: tr } = await context.supabase
          .from("ticket_transfers")
          .select("id")
          .eq("ticket_id", data.id)
          .eq("from_user", context.userId)
          .eq("kind", "gift")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!tr) return { sent: false };
        const { notifyGift } = await import("./email/resale-notify.server");
        await notifyGift(tr.id, origin);
        return { sent: true };
      }
      // Trades: RLS only returns trades the caller is part of (or admin)
      const { data: trade } = await context.supabase
        .from("resale_trades")
        .select("id, status")
        .eq("id", data.id)
        .maybeSingle();
      const expected: Record<string, string> = {
        reserved: "awaiting_payment",
        paid: "paid",
        released: "released",
        disputed: "disputed",
        cancelled: "cancelled",
      };
      if (!trade || trade.status !== expected[data.kind]) return { sent: false };
      const { notifyTrade } = await import("./email/resale-notify.server");
      await notifyTrade(trade.id, data.kind as any, origin);
      return { sent: true };
    } catch (e) {
      console.error("[resale] notice failed", e);
      return { sent: false };
    }
  });
