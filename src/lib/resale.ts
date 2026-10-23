import { supabase } from "@/integrations/supabase/client";
import { sendResaleNotice } from "@/lib/resale.functions";

export type TradeStatus = "awaiting_payment" | "paid" | "released" | "cancelled" | "disputed" | "expired";

export const TRADE_STATUS: Record<TradeStatus, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  awaiting_payment: { label: "Awaiting payment", tone: "secondary" },
  paid: { label: "Marked paid", tone: "default" },
  released: { label: "Completed", tone: "default" },
  cancelled: { label: "Cancelled", tone: "outline" },
  disputed: { label: "In dispute", tone: "destructive" },
  expired: { label: "Expired", tone: "outline" },
};

/** Columns of a listing anyone may read (the seller's phone is never exposed here). */
export const LISTING_COLUMNS =
  "id, ticket_id, event_id, ticket_type_id, seller_id, seller_name, price_kes, face_value_kes, note, status, created_at";

export type PublicListing = {
  id: string;
  ticket_id: string;
  event_id: string;
  ticket_type_id: string;
  seller_id: string;
  seller_name: string | null;
  price_kes: number;
  face_value_kes: number;
  note: string | null;
  status: string;
  created_at: string;
};

/** Friendly message from a database function error. */
export function rpcError(e: unknown) {
  const m = (e as { message?: string })?.message ?? String(e);
  return m.replace(/^.*?ERROR:\s*/i, "");
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw new Error(rpcError(error));
  return data as T;
}

/** Fire-and-forget email follow-up; never blocks or fails the action. */
export function notice(kind: "gift" | "reserved" | "paid" | "released" | "disputed" | "cancelled", id: string) {
  sendResaleNotice({ data: { kind, id, origin: window.location.origin } }).catch(() => {});
}

export const resale = {
  gift: (ticketId: string, email: string, name: string, note?: string) =>
    call<{ code: string; to_user: string | null }>("gift_ticket", {
      _ticket_id: ticketId,
      _to_email: email,
      _to_name: name,
      _note: note || null,
    }),
  claim: () => call<number>("claim_my_tickets", {}),
  list: (ticketId: string, price: number, phone: string, note?: string) =>
    call<string>("create_resale_listing", { _ticket_id: ticketId, _price: price, _phone: phone, _note: note || null }),
  update: (listingId: string, price: number, note?: string) =>
    call<void>("update_resale_listing", { _listing_id: listingId, _price: price, _note: note || null }),
  unlist: (listingId: string) => call<void>("cancel_resale_listing", { _listing_id: listingId }),
  buy: (listingId: string, phone: string, name: string) =>
    call<string>("start_resale_trade", { _listing_id: listingId, _buyer_phone: phone, _buyer_name: name }),
  markPaid: (tradeId: string, ref: string) => call<void>("mark_trade_paid", { _trade_id: tradeId, _payment_ref: ref }),
  release: (tradeId: string) => call<string>("release_trade", { _trade_id: tradeId }),
  cancel: (tradeId: string, reason?: string) => call<void>("cancel_trade", { _trade_id: tradeId, _reason: reason || null }),
  dispute: (tradeId: string, reason: string) => call<void>("dispute_trade", { _trade_id: tradeId, _reason: reason }),
  resolve: (tradeId: string, action: "release" | "cancel", note?: string) =>
    call<void>("admin_resolve_trade", { _trade_id: tradeId, _action: action, _note: note || null }),
  expire: () => call<number>("expire_resale_trades", {}),
};

/** Max resale price allowed by the organizer, or null if uncapped. */
export function resaleCap(face: number, markupPct: number | null | undefined) {
  if (markupPct == null || !face) return null;
  return Math.round(face * (1 + markupPct / 100));
}
