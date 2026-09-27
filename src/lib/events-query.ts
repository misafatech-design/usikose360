import { supabase } from "@/integrations/supabase/client";
import type { EventCardData } from "@/components/event-card";

export type PublicEvent = EventCardData & { is_featured: boolean };

export async function fetchPublishedEvents(): Promise<PublicEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id,title,summary,category,city,venue,cover_url,starts_at,is_featured,ticket_types(price_kes)")
    .eq("status", "published")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((e) => {
    const prices = (e.ticket_types ?? []).map((t) => Number(t.price_kes));
    const { ticket_types: _t, ...rest } = e;
    return { ...rest, from_price: prices.length ? Math.min(...prices) : null } as PublicEvent;
  });
}

export const CATEGORIES = ["Music", "Nightlife", "Business", "Sports", "Tech", "Food & Drink", "Faith", "General"];
