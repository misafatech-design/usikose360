import forge from "node-forge";

export type MpesaEnv = "sandbox" | "production";

export type MpesaConfigRow = {
  id: string;
  environment: MpesaEnv;
  is_active: boolean;
  shortcode: string | null;
  party_b: string | null;
  passkey: string | null;
  consumer_key: string | null;
  consumer_secret: string | null;
  transaction_type: string;
  callback_base_url: string | null;
  b2c_shortcode: string | null;
  b2c_initiator_name: string | null;
  b2c_security_credential: string | null;
  b2c_consumer_key: string | null;
  b2c_consumer_secret: string | null;
  b2c_command_id: string;
  callback_token: string;
};

export function baseUrl(env: MpesaEnv) {
  return env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getActiveConfig(): Promise<MpesaConfigRow | null> {
  const db = await admin();
  const { data } = await db.from("mpesa_config").select("*").eq("is_active", true).maybeSingle();
  const c = data as MpesaConfigRow | null;
  if (!c || !c.shortcode || !c.passkey || !c.consumer_key || !c.consumer_secret) return null;
  return c;
}

export async function getConfigByToken(token: string): Promise<MpesaConfigRow | null> {
  if (!token) return null;
  const db = await admin();
  const { data } = await db.from("mpesa_config").select("*").eq("callback_token", token).maybeSingle();
  return (data as MpesaConfigRow | null) ?? null;
}

export async function getAccessToken(env: MpesaEnv, key: string, secret: string) {
  const auth = btoa(`${key}:${secret}`);
  const res = await fetch(`${baseUrl(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`M-Pesa auth failed (${res.status}): ${text.slice(0, 200)}`);
  const json = JSON.parse(text) as { access_token: string };
  return json.access_token;
}

/** yyyyMMddHHmmss in Nairobi time (UTC+3) */
export function timestamp() {
  const d = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  return d.replace(/[-:T]/g, "").slice(0, 14);
}

function stkPassword(c: MpesaConfigRow, ts: string) {
  return btoa(`${c.shortcode}${c.passkey}${ts}`);
}

export function callbackUrl(c: MpesaConfigRow, path: string, fallbackOrigin: string) {
  const base = (c.callback_base_url || fallbackOrigin).replace(/\/$/, "");
  return `${base}/api/public/mpesa/${path}?token=${c.callback_token}`;
}

export async function stkPush(
  c: MpesaConfigRow,
  opts: { amount: number; phone: string; reference: string; description: string; origin: string },
) {
  const token = await getAccessToken(c.environment, c.consumer_key!, c.consumer_secret!);
  const ts = timestamp();
  const res = await fetch(`${baseUrl(c.environment)}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: c.shortcode,
      Password: stkPassword(c, ts),
      Timestamp: ts,
      TransactionType: c.transaction_type,
      Amount: Math.max(1, Math.round(opts.amount)),
      PartyA: opts.phone,
      PartyB: c.party_b || c.shortcode,
      PhoneNumber: opts.phone,
      CallBackURL: callbackUrl(c, "stk-callback", opts.origin),
      AccountReference: opts.reference.slice(0, 12),
      TransactionDesc: opts.description.slice(0, 13),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || json.ResponseCode !== "0") {
    throw new Error(json.errorMessage || json.ResponseDescription || "Could not send M-Pesa prompt");
  }
  return { checkoutRequestId: json.CheckoutRequestID, merchantRequestId: json.MerchantRequestID };
}

/** Returns resultCode when final, or null if still processing */
export async function stkQuery(c: MpesaConfigRow, checkoutRequestId: string) {
  const token = await getAccessToken(c.environment, c.consumer_key!, c.consumer_secret!);
  const ts = timestamp();
  const res = await fetch(`${baseUrl(c.environment)}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: c.shortcode,
      Password: stkPassword(c, ts),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (json.ResultCode === undefined) return null; // still processing
  return { resultCode: Number(json.ResultCode), resultDesc: json.ResultDesc ?? "" };
}

export async function b2cPayment(
  c: MpesaConfigRow,
  opts: { amount: number; phone: string; originatorId: string; remarks: string; origin: string },
) {
  const key = c.b2c_consumer_key || c.consumer_key;
  const secret = c.b2c_consumer_secret || c.consumer_secret;
  if (!key || !secret || !c.b2c_shortcode || !c.b2c_initiator_name || !c.b2c_security_credential) {
    throw new Error("Payouts are not configured yet");
  }
  const token = await getAccessToken(c.environment, key, secret);
  const res = await fetch(`${baseUrl(c.environment)}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      OriginatorConversationID: opts.originatorId,
      InitiatorName: c.b2c_initiator_name,
      SecurityCredential: c.b2c_security_credential,
      CommandID: c.b2c_command_id,
      Amount: Math.round(opts.amount),
      PartyA: c.b2c_shortcode,
      PartyB: opts.phone,
      Remarks: opts.remarks.slice(0, 100),
      QueueTimeOutURL: callbackUrl(c, "b2c-timeout", opts.origin),
      ResultURL: callbackUrl(c, "b2c-result", opts.origin),
      Occasion: "Payout",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || json.ResponseCode !== "0") {
    throw new Error(json.errorMessage || json.ResponseDescription || "Payout request failed");
  }
  return { conversationId: json.ConversationID };
}

/**
 * Daraja security credential: encrypt the initiator password with the
 * M-Pesa public certificate (RSA, PKCS#1 v1.5) and base64-encode it.
 */
export function generateSecurityCredential(certPem: string, initiatorPassword: string) {
  const cert = forge.pki.certificateFromPem(certPem.trim());
  const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
  const encrypted = publicKey.encrypt(initiatorPassword, "RSAES-PKCS1-V1_5");
  return forge.util.encode64(encrypted);
}

/** Create tickets and mark an order paid (idempotent). */
export async function fulfillOrder(orderId: string, receipt: string | null, resultDesc: string) {
  const db = await admin();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!order || order.status === "paid") return;
  const { error } = await db
    .from("orders")
    .update({
      status: "paid",
      mpesa_receipt: receipt,
      result_code: 0,
      result_desc: resultDesc,
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .neq("status", "paid");
  if (error) throw error;
  const items: { ticket_type_id: string; quantity: number }[] =
    Array.isArray(order.items) && order.items.length
      ? (order.items as any)
      : [{ ticket_type_id: order.ticket_type_id, quantity: order.quantity }];
  const attendees: { name?: string; email?: string; phone?: string }[] = Array.isArray(order.attendees)
    ? (order.attendees as any)
    : [];
  const rows: any[] = [];
  for (const it of items) {
    for (let i = 0; i < it.quantity; i++) {
      const a = attendees[rows.length] ?? attendees[0] ?? {};
      rows.push({
        order_id: order.id,
        event_id: order.event_id,
        ticket_type_id: it.ticket_type_id,
        holder_id: order.buyer_id,
        attendee_name: a.name ?? order.buyer_name ?? null,
        attendee_email: a.email ?? order.buyer_email ?? null,
        attendee_phone: a.phone ?? order.mpesa_phone ?? null,
      });
    }
  }
  await db.from("tickets").insert(rows);
  for (const it of items) {
    const { data: tt } = await db.from("ticket_types").select("sold").eq("id", it.ticket_type_id).single();
    if (tt) await db.from("ticket_types").update({ sold: tt.sold + it.quantity }).eq("id", it.ticket_type_id);
  }
}

export async function failOrder(orderId: string, code: number, desc: string) {
  const db = await admin();
  await db
    .from("orders")
    .update({ status: "failed", result_code: code, result_desc: desc })
    .eq("id", orderId)
    .eq("status", "pending");
}
