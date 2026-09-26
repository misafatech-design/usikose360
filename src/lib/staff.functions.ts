import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(supabase: any, eventId: string, userId: string) {
  const { data: ev } = await supabase.from("events").select("organizer_id").eq("id", eventId).single();
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!ev || (ev.organizer_id !== userId && !isAdmin)) throw new Error("Only the event organizer can manage staff");
}

export const addEventStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ eventId: z.string().uuid(), email: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.eventId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    let found: { id: string } | undefined;
    for (let page = 1; page <= 20 && !found; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      found = list.users.find((u) => u.email?.toLowerCase() === email);
      if (list.users.length < 200) break;
    }
    if (!found) throw new Error("No Usikose360 account uses that email. Ask them to sign up first.");
    const { error } = await supabaseAdmin
      .from("event_staff")
      .upsert(
        { event_id: data.eventId, user_id: found.id, email, role: "admission", added_by: context.userId },
        { onConflict: "event_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const admitTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ eventId: z.string().uuid(), code: z.string().trim().min(4).max(64), undo: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // RLS: only owner, admin, or admission staff of this event can read/update
    const code = data.code.toUpperCase();
    const { data: t } = await context.supabase
      .from("tickets")
      .select("id, code, checked_in_at, event_id, ticket_types(name)")
      .eq("event_id", data.eventId)
      .eq("code", code)
      .maybeSingle();
    if (!t) return { result: "invalid" as const, code };
    if (data.undo) {
      await context.supabase.from("tickets").update({ checked_in_at: null }).eq("id", t.id);
      return { result: "undone" as const, code, type: t.ticket_types?.name ?? "" };
    }
    if (t.checked_in_at) {
      return { result: "already" as const, code, type: t.ticket_types?.name ?? "", at: t.checked_in_at };
    }
    const { error } = await context.supabase
      .from("tickets")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) throw new Error("You are not allowed to admit guests for this event");
    return { result: "admitted" as const, code, type: t.ticket_types?.name ?? "" };
  });
