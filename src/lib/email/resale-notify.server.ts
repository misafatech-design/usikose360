import { sendMail } from "./smtp.server";
import { setPasswordEmail, ticketTransferEmail, tradeUpdateEmail } from "./templates.server";
import { recoveryLink } from "./notify.server";

async function admin() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  return supabaseAdmin;
}

async function userInfo(id: string | null) {
  if (!id) return { email: null as string | null, name: "" };
  const db = await admin();
  const [{ data: u }, { data: prof }] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.from("profiles").select("full_name").eq("id", id).maybeSingle(),
  ]);
  return { email: u?.user?.email ?? null, name: prof?.full_name ?? "" };
}

/** Recipient of a gift: make sure they have an account holding the ticket, then email it. */
export async function notifyGift(transferId: string, origin: string) {
  const db = await admin();
  const { data: tr } = await db.from("ticket_transfers").select("*").eq("id", transferId).single();
  if (!tr) return;
  const { data: t } = await db
    .from("tickets")
    .select("id, code, holder_id, attendee_name, attendee_email, ticket_types(name), events(title, starts_at, venue, city)")
    .eq("id", tr.ticket_id)
    .single();
  if (!t || !t.events) return;
  const email = String(tr.to_email ?? t.attendee_email ?? "").toLowerCase();
  if (!email) return;

  let newAccount = false;
  if (!t.holder_id) {
    const created = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: tr.to_name ?? "", needs_password: true },
    });
    let uid = created.data?.user?.id ?? null;
    if (uid) newAccount = true;
    else {
      const { data } = await db.auth.admin.generateLink({ type: "magiclink", email });
      uid = data?.user?.id ?? null;
    }
    if (uid) {
      await db.from("tickets").update({ holder_id: uid }).eq("id", t.id).is("holder_id", null);
      await db.from("ticket_transfers").update({ to_user: uid }).eq("id", tr.id);
    }
    if (newAccount) {
      const r = await recoveryLink(email, origin, true);
      if (r) {
        const m = setPasswordEmail({ origin, name: tr.to_name ?? "", link: r.link });
        await sendMail({ to: email, subject: m.subject, html: m.html, kind: "set_password" });
      }
    }
  }

  const sender = await userInfo(tr.from_user);
  const m = ticketTransferEmail({
    origin,
    recipientName: tr.to_name ?? "",
    senderName: sender.name || sender.email || "A friend",
    event: t.events as any,
    ticket: { code: t.code, type: (t.ticket_types as any)?.name ?? "Ticket", attendee: t.attendee_name },
    note: tr.note,
    pdfUrl: `${origin}/api/public/tickets/pdf?codes=${encodeURIComponent(t.code)}`,
    newAccount,
  });
  await sendMail({ to: email, subject: m.subject, html: m.html, kind: "ticket_transfer" });
}

export type TradeStep = "reserved" | "paid" | "released" | "disputed" | "cancelled";

export async function notifyTrade(tradeId: string, step: TradeStep, origin: string) {
  const db = await admin();
  const { data: tr } = await db.from("resale_trades").select("*, events(title)").eq("id", tradeId).single();
  if (!tr) return;
  const eventTitle = (tr.events as any)?.title ?? "your event";
  const url = `${origin}/trades/${tr.id}`;
  const price = Number(tr.price_kes);
  const [buyer, seller] = await Promise.all([userInfo(tr.buyer_id), userInfo(tr.seller_id)]);

  const send = async (to: string | null, name: string, heading: string, message: string, ctaLabel: string, extra?: string) => {
    if (!to) return;
    const m = tradeUpdateEmail({ origin, name, heading, message, eventTitle, price, ctaUrl: url, ctaLabel, ...(extra ? { extra } : {}) });
    await sendMail({ to, subject: m.subject, html: m.html, kind: `resale_${step}` });
  };

  if (step === "reserved") {
    await send(seller.email, seller.name, "A buyer reserved your ticket", "someone is buying your resale ticket. They have 30 minutes to send you the money by M-Pesa. Don't release the ticket until the money is in your M-Pesa.", "Open the trade");
  } else if (step === "paid") {
    await send(seller.email, seller.name, "Buyer says they've paid", `the buyer marked the trade as paid with M-Pesa code <strong>${tr.payment_ref ?? ""}</strong>. Check your M-Pesa messages, then release the ticket.`, "Check and release");
  } else if (step === "released") {
    await send(buyer.email, buyer.name || tr.buyer_name || "", "Your ticket is here", "the seller released the ticket. It now sits in your account with a brand-new QR code.", "View my ticket");
    await send(seller.email, seller.name, "Ticket sold", "the trade is complete and the ticket has moved to the buyer. Thanks for selling on Usikose360.", "View trade");
  } else if (step === "disputed") {
    const other = tr.disputed_by === tr.buyer_id ? seller : buyer;
    await send(other.email, other.name, "A dispute was opened", "the other party opened a dispute on this trade. An administrator will review it. You can add details in the trade chat.", "Open the trade");
  } else if (step === "cancelled") {
    await send(seller.email, seller.name, "Trade cancelled", "the buyer cancelled the trade. Your ticket is back on the resale market.", "View trade");
  }
}
