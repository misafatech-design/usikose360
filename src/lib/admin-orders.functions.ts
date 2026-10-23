import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Only system administrators can do this");
}

/** Admin: confirm a payment manually (e.g. a missed M-Pesa callback) and release the tickets. */
export const adminMarkOrderPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        receipt: z.string().trim().max(40).optional(),
        note: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("Order not found");
    if (order.status === "paid") throw new Error("This order is already paid");
    if (order.status === "refunded") throw new Error("Refunded orders can't be marked paid");
    // fulfillOrder only acts on non-paid orders; reset failed orders to pending first
    if (order.status === "failed") {
      await supabaseAdmin.from("orders").update({ status: "pending" }).eq("id", order.id);
    }
    const { fulfillOrder } = await import("./mpesa.server");
    const receipt = data.receipt ? data.receipt.toUpperCase() : null;
    await fulfillOrder(order.id, receipt, `Marked paid by administrator${data.note ? `: ${data.note}` : ""}`);
    const { count } = await supabaseAdmin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id);
    return { ok: true, tickets: count ?? 0 };
  });

/** Admin: resend the confirmation + ticket emails for a paid order. */
export const adminResendOrderEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { data: order } = await supabaseAdmin.from("orders").select("status").eq("id", data.orderId).single();
    if (order?.status !== "paid") throw new Error("Only paid orders have tickets to send");
    await supabaseAdmin.from("orders").update({ emails_sent_at: null }).eq("id", data.orderId);
    const { afterOrderPaid } = await import("./email/notify.server");
    await afterOrderPaid(data.orderId);
    return { ok: true };
  });

/** Admin: list orders with filters (service role so guest orders are included). */
export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["all", "pending", "paid", "failed", "refunded"]).default("all"),
        search: z.string().trim().max(80).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    let q = supabaseAdmin
      .from("orders")
      .select(
        "id, created_at, status, total_kes, quantity, buyer_name, buyer_email, mpesa_phone, mpesa_receipt, result_desc, environment, events(title)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.search) {
      const s = data.search.replace(/[%,()]/g, "");
      q = q.or(`buyer_email.ilike.%${s}%,buyer_name.ilike.%${s}%,mpesa_phone.ilike.%${s}%,mpesa_receipt.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
