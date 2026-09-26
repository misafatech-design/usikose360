import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  b2cPayment,
  failOrder,
  fulfillOrder,
  generateSecurityCredential,
  getActiveConfig,
  stkPush,
  stkQuery,
  type MpesaConfigRow,
} from "./mpesa.server";

function origin() {
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "https://usikose360.lovable.app";
  }
}

function normalizePhone(input: string) {
  const d = input.replace(/\D/g, "");
  if (d.startsWith("254")) return d;
  if (d.startsWith("0")) return `254${d.slice(1)}`;
  if (d.length === 9) return `254${d}`;
  return d;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Only system administrators can do this");
}

const mask = (v: string | null) => (v ? `••••${v.slice(-4)}` : "");

/* ---------------- Admin config ---------------- */

export const getMpesaSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("mpesa_config").select("*");
    const rows = (data ?? []) as MpesaConfigRow[];
    const o = origin();
    return (["sandbox", "production"] as const).map((env) => {
      const r = rows.find((x) => x.environment === env);
      const base = (r?.callback_base_url || o).replace(/\/$/, "");
      return {
        environment: env,
        exists: !!r,
        is_active: r?.is_active ?? false,
        shortcode: r?.shortcode ?? "",
        party_b: r?.party_b ?? "",
        transaction_type: r?.transaction_type ?? "CustomerPayBillOnline",
        callback_base_url: r?.callback_base_url ?? "",
        passkey_set: mask(r?.passkey ?? null),
        consumer_key_set: mask(r?.consumer_key ?? null),
        consumer_secret_set: mask(r?.consumer_secret ?? null),
        b2c_shortcode: r?.b2c_shortcode ?? "",
        b2c_initiator_name: r?.b2c_initiator_name ?? "",
        b2c_command_id: r?.b2c_command_id ?? "BusinessPayment",
        b2c_credential_set: mask(r?.b2c_security_credential ?? null),
        b2c_consumer_key_set: mask(r?.b2c_consumer_key ?? null),
        b2c_consumer_secret_set: mask(r?.b2c_consumer_secret ?? null),
        stk_callback: r ? `${base}/api/public/mpesa/stk-callback?token=${r.callback_token}` : "",
        b2c_result: r ? `${base}/api/public/mpesa/b2c-result?token=${r.callback_token}` : "",
      };
    });
  });

const opt = z.string().trim().max(4000).optional();

export const saveMpesaSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        environment: z.enum(["sandbox", "production"]),
        is_active: z.boolean(),
        shortcode: opt,
        party_b: opt,
        transaction_type: z.enum(["CustomerPayBillOnline", "CustomerBuyGoodsOnline"]),
        callback_base_url: opt,
        passkey: opt,
        consumer_key: opt,
        consumer_secret: opt,
        b2c_shortcode: opt,
        b2c_initiator_name: opt,
        b2c_command_id: z.enum(["BusinessPayment", "SalaryPayment", "PromotionPayment"]),
        b2c_consumer_key: opt,
        b2c_consumer_secret: opt,
        b2c_initiator_password: opt,
        b2c_certificate: opt,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {
      environment: data.environment,
      is_active: data.is_active,
      shortcode: data.shortcode || null,
      party_b: data.party_b || null,
      transaction_type: data.transaction_type,
      callback_base_url: data.callback_base_url || null,
      b2c_shortcode: data.b2c_shortcode || null,
      b2c_initiator_name: data.b2c_initiator_name || null,
      b2c_command_id: data.b2c_command_id,
    };
    // Secrets only overwrite when a new value is entered
    for (const k of ["passkey", "consumer_key", "consumer_secret", "b2c_consumer_key", "b2c_consumer_secret"] as const) {
      if (data[k]) patch[k] = data[k];
    }
    if (data.b2c_initiator_password) {
      if (!data.b2c_certificate) throw new Error("Paste the M-Pesa public certificate to generate the credential");
      try {
        patch.b2c_security_credential = generateSecurityCredential(
          data.b2c_certificate,
          data.b2c_initiator_password,
        );
      } catch {
        throw new Error("That certificate could not be read. Paste the full .cer contents including BEGIN/END lines.");
      }
    }

    if (data.is_active) {
      await supabaseAdmin
        .from("mpesa_config")
        .update({ is_active: false })
        .neq("environment", data.environment);
    }
    const { error } = await supabaseAdmin
      .from("mpesa_config")
      .upsert(patch as never, { onConflict: "environment" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPaymentMode = createServerFn({ method: "GET" }).handler(async () => {
  const c = await getActiveConfig();
  return { live: !!c, environment: c?.environment ?? null };
});

/* ---------------- Checkout (STK push) ---------------- */

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ticketTypeId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
        phone: z.string().min(9).max(15),
        orderId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const phone = normalizePhone(data.phone);
    if (!/^254(7|1)\d{8}$/.test(phone)) throw new Error("Enter a valid Kenyan phone number");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tt } = await supabaseAdmin
      .from("ticket_types")
      .select("*, events(id, title, status)")
      .eq("id", data.ticketTypeId)
      .single();
    if (!tt || tt.events?.status !== "published") throw new Error("Tickets are not on sale");
    if (tt.sold + data.quantity > tt.quantity) throw new Error("Not enough tickets left");
    const total = Number(tt.price_kes) * data.quantity;

    const { data: claims } = await context.supabase.auth.getUser();
    const config = await getActiveConfig();

    let orderId = data.orderId;
    if (orderId) {
      const { data: existing } = await supabaseAdmin
        .from("orders")
        .select("id, buyer_id, status")
        .eq("id", orderId)
        .single();
      if (!existing || existing.buyer_id !== context.userId || existing.status === "paid") {
        throw new Error("This order cannot be retried");
      }
      await supabaseAdmin
        .from("orders")
        .update({ status: "pending", result_code: null, result_desc: null, mpesa_phone: phone, checkout_request_id: null })
        .eq("id", orderId);
    } else {
      const { data: order, error } = await supabaseAdmin
        .from("orders")
        .insert({
          buyer_id: context.userId,
          event_id: tt.event_id,
          ticket_type_id: tt.id,
          quantity: data.quantity,
          total_kes: total,
          buyer_email: claims.user?.email ?? null,
          mpesa_phone: phone,
          mpesa_reference: `USK${Date.now().toString(36).toUpperCase()}`,
          status: "pending",
          environment: config?.environment ?? "demo",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      orderId = order.id;
    }

    // Free tickets or no M-Pesa configured → confirm without charging
    if (total <= 0 || !config) {
      await fulfillOrder(orderId!, null, total <= 0 ? "Free ticket" : "Demo — no charge");
      return { orderId: orderId!, mode: "instant" as const };
    }

    try {
      const res = await stkPush(config, {
        amount: total,
        phone,
        reference: "USIKOSE360",
        description: "Event ticket",
        origin: origin(),
      });
      await supabaseAdmin
        .from("orders")
        .update({ checkout_request_id: res.checkoutRequestId, merchant_request_id: res.merchantRequestId })
        .eq("id", orderId!);
      return { orderId: orderId!, mode: "stk" as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "M-Pesa request failed";
      await failOrder(orderId!, -1, msg);
      throw new Error(msg);
    }
  });

export const getOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), query: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, result_desc, mpesa_receipt, checkout_request_id, updated_at")
      .eq("id", data.orderId)
      .single();
    if (!order || order.buyer_id !== context.userId) throw new Error("Order not found");

    // Fallback: ask Safaricom directly if the callback is slow
    if (order.status === "pending" && data.query && order.checkout_request_id) {
      const config = await getActiveConfig();
      if (config) {
        const r = await stkQuery(config, order.checkout_request_id).catch(() => null);
        if (r) {
          if (r.resultCode === 0) await fulfillOrder(order.id, null, r.resultDesc);
          else await failOrder(order.id, r.resultCode, r.resultDesc);
          const { data: fresh } = await supabaseAdmin
            .from("orders")
            .select("status, result_desc, mpesa_receipt")
            .eq("id", order.id)
            .single();
          return fresh!;
        }
      }
    }
    return { status: order.status, result_desc: order.result_desc, mpesa_receipt: order.mpesa_receipt };
  });

/* ---------------- Organizer payouts (B2C) ---------------- */

export const getPayoutSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: events } = await supabaseAdmin.from("events").select("id").eq("organizer_id", context.userId);
    const ids = (events ?? []).map((e) => e.id);
    let earned = 0;
    if (ids.length) {
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("total_kes, environment")
        .in("event_id", ids)
        .eq("status", "paid")
        .neq("environment", "demo");
      earned = (orders ?? []).reduce((s, o) => s + Number(o.total_kes), 0);
    }
    const { data: payouts } = await supabaseAdmin
      .from("payouts")
      .select("*")
      .eq("organizer_id", context.userId)
      .order("created_at", { ascending: false });
    const withdrawn = (payouts ?? [])
      .filter((p) => p.status !== "failed")
      .reduce((s, p) => s + Number(p.amount_kes), 0);
    const config = await getActiveConfig();
    return {
      earned,
      withdrawn,
      available: Math.max(0, earned - withdrawn),
      payouts: payouts ?? [],
      payoutsEnabled: !!config?.b2c_security_credential,
    };
  });

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ amount: z.number().min(10).max(250000), phone: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isOrg } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "organizer" });
    if (!isOrg) throw new Error("Only organizers can withdraw");
    const phone = normalizePhone(data.phone);
    if (!/^254(7|1)\d{8}$/.test(phone)) throw new Error("Enter a valid Kenyan phone number");
    const config = await getActiveConfig();
    if (!config) throw new Error("M-Pesa is not configured");

    const summary = await getPayoutSummaryInternal(context.userId);
    if (data.amount > summary.available) throw new Error("Amount exceeds your available balance");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const originatorId = crypto.randomUUID();
    const { data: payout, error } = await supabaseAdmin
      .from("payouts")
      .insert({
        organizer_id: context.userId,
        amount_kes: data.amount,
        phone,
        status: "processing",
        environment: config.environment,
        originator_conversation_id: originatorId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    try {
      const r = await b2cPayment(config, {
        amount: data.amount,
        phone,
        originatorId,
        remarks: "Usikose360 organizer payout",
        origin: origin(),
      });
      await supabaseAdmin.from("payouts").update({ conversation_id: r.conversationId }).eq("id", payout.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payout failed";
      await supabaseAdmin.from("payouts").update({ status: "failed", result_desc: msg }).eq("id", payout.id);
      throw new Error(msg);
    }
    return { ok: true };
  });

async function getPayoutSummaryInternal(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: events } = await supabaseAdmin.from("events").select("id").eq("organizer_id", userId);
  const ids = (events ?? []).map((e) => e.id);
  let earned = 0;
  if (ids.length) {
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("total_kes")
      .in("event_id", ids)
      .eq("status", "paid")
      .neq("environment", "demo");
    earned = (orders ?? []).reduce((s, o) => s + Number(o.total_kes), 0);
  }
  const { data: payouts } = await supabaseAdmin
    .from("payouts")
    .select("amount_kes, status")
    .eq("organizer_id", userId);
  const withdrawn = (payouts ?? []).filter((p) => p.status !== "failed").reduce((s, p) => s + Number(p.amount_kes), 0);
  return { available: Math.max(0, earned - withdrawn) };
}
