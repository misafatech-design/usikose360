import { sendMail } from "./smtp.server";
import {
  attendeeTicketEmail,
  orderConfirmationEmail,
  passwordResetEmail,
  paymentFailedEmail,
  setPasswordEmail,
  type TicketInfo,
} from "./templates.server";

const FALLBACK_ORIGIN = "https://usikose360.lovable.app";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Recovery link that always lands on the website the user was on. */
export async function recoveryLink(email: string, origin: string, setup = false) {
  const db = await admin();
  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data?.properties?.hashed_token) return null;
  const url = new URL("/reset-password", origin);
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", "recovery");
  if (setup) url.searchParams.set("setup", "1");
  return { link: url.toString(), userId: data.user?.id ?? null };
}

export async function sendPasswordReset(email: string, origin: string) {
  const r = await recoveryLink(email, origin);
  if (!r) return; // unknown email: stay silent
  const m = passwordResetEmail({ origin, link: r.link });
  await sendMail({ to: email, subject: m.subject, html: m.html, kind: "password_reset" });
}

/** Guest buyers: create (or find) an account and attach the order + tickets to it. */
async function ensureBuyerAccount(order: any, origin: string) {
  if (order.buyer_id || !order.buyer_email) return { newAccount: false };
  const db = await admin();
  const email = String(order.buyer_email).trim().toLowerCase();
  let userId: string | null = null;
  let newAccount = false;
  const created = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: order.buyer_name, phone: order.mpesa_phone, needs_password: true },
  });
  if (created.data?.user) {
    userId = created.data.user.id;
    newAccount = true;
  } else {
    const { data } = await db.auth.admin.generateLink({ type: "magiclink", email });
    userId = data?.user?.id ?? null;
  }
  if (!userId) return { newAccount: false };
  await db.from("orders").update({ buyer_id: userId }).eq("id", order.id);
  await db.from("tickets").update({ holder_id: userId }).eq("order_id", order.id).is("holder_id", null);

  if (newAccount) {
    const r = await recoveryLink(email, origin, true);
    if (r) {
      const m = setPasswordEmail({ origin, name: order.buyer_name ?? "", link: r.link });
      await sendMail({ to: email, subject: m.subject, html: m.html, kind: "set_password", orderId: order.id });
    }
  }
  return { newAccount };
}

/** Runs once per paid order: links guest account and emails every ticket. */
export async function afterOrderPaid(orderId: string) {
  const db = await admin();
  const { data: claimed } = await db
    .from("orders")
    .update({ emails_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("emails_sent_at", null)
    .select("*")
    .maybeSingle();
  if (!claimed) return;
  const order = claimed as any;
  const origin = order.site_origin || FALLBACK_ORIGIN;

  const { newAccount } = await ensureBuyerAccount(order, origin);

  const { data: event } = await db
    .from("events")
    .select("title, starts_at, venue, city")
    .eq("id", order.event_id)
    .single();
  const { data: tickets } = await db
    .from("tickets")
    .select("code, attendee_name, attendee_email, ticket_types(name, price_kes)")
    .eq("order_id", orderId)
    .order("created_at");
  if (!event || !tickets?.length) return;

  const all: TicketInfo[] = tickets.map((t: any) => ({
    code: t.code,
    type: t.ticket_types?.name ?? "Ticket",
    attendee: t.attendee_name,
    email: t.attendee_email,
  }));
  const lineMap = new Map<string, { name: string; qty: number; price: number }>();
  for (const t of tickets as any[]) {
    const name = t.ticket_types?.name ?? "Ticket";
    const l = lineMap.get(name) ?? { name, qty: 0, price: Number(t.ticket_types?.price_kes ?? 0) };
    l.qty++;
    lineMap.set(name, l);
  }

  const buyerEmail = String(order.buyer_email ?? "").trim().toLowerCase();
  if (buyerEmail) {
    const m = orderConfirmationEmail({
      origin,
      buyerName: order.buyer_name ?? "",
      event,
      lines: [...lineMap.values()],
      total: Number(order.total_kes),
      receipt: order.mpesa_receipt,
      reference: order.mpesa_reference,
      tickets: all,
      pdfUrl: `${origin}/api/public/tickets/pdf?order=${order.id}&token=${order.access_token}`,
      newAccount,
    });
    await sendMail({ to: buyerEmail, subject: m.subject, html: m.html, kind: "order_confirmation", orderId });
  }

  // Individual tickets to every other attendee email
  const byEmail = new Map<string, TicketInfo[]>();
  for (const t of all) {
    const e = String(t.email ?? "").trim().toLowerCase();
    if (!e || e === buyerEmail) continue;
    byEmail.set(e, [...(byEmail.get(e) ?? []), t]);
  }
  for (const [email, list] of byEmail) {
    const codes = list.map((t) => t.code).join(",");
    const m = attendeeTicketEmail({
      origin,
      attendeeName: list[0]!.attendee ?? "",
      buyerName: order.buyer_name ?? "",
      event,
      tickets: list,
      pdfUrl: `${origin}/api/public/tickets/pdf?codes=${encodeURIComponent(codes)}`,
    });
    await sendMail({ to: email, subject: m.subject, html: m.html, kind: "attendee_ticket", orderId });
  }
}

export async function afterOrderFailed(orderId: string, reason: string) {
  const db = await admin();
  const { data: order } = await db
    .from("orders")
    .select("id, buyer_email, buyer_name, event_id, site_origin")
    .eq("id", orderId)
    .single();
  if (!order?.buyer_email) return;
  const { data: event } = await db.from("events").select("title").eq("id", order.event_id).single();
  const origin = order.site_origin || FALLBACK_ORIGIN;
  const m = paymentFailedEmail({
    origin,
    name: order.buyer_name ?? "",
    eventTitle: event?.title ?? "your event",
    reason,
    eventUrl: `${origin}/events/${order.event_id}`,
  });
  await sendMail({ to: order.buyer_email, subject: m.subject, html: m.html, kind: "payment_failed", orderId });
}
