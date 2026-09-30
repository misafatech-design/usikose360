import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Only system administrators can do this");
}

/** Use the website the request came from (custom domain aware). */
function requestOrigin(claimed?: string) {
  const req = getRequest();
  const own = new URL(req.url).origin;
  const hdr = req.headers.get("origin");
  if (claimed) {
    try {
      const c = new URL(claimed).origin;
      if (hdr && new URL(hdr).origin === c) return c;
    } catch {
      /* ignore */
    }
  }
  return hdr || own;
}

export const getEmailSettingsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { getEmailSettings } = await import("./email/smtp.server");
    const s = await getEmailSettings();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: log } = await supabaseAdmin
      .from("email_log")
      .select("id, kind, recipient, subject, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    return {
      settings: {
        enabled: s?.enabled ?? false,
        host: s?.host ?? "",
        port: s?.port ?? 465,
        security: (s?.security as string) ?? "ssl",
        username: s?.username ?? "",
        hasPassword: !!s?.password,
        from_name: s?.from_name ?? "Usikose360",
        from_email: s?.from_email ?? "",
        reply_to: s?.reply_to ?? "",
        allow_self_signed: s?.allow_self_signed ?? false,
      },
      log: log ?? [],
    };
  });

const settingsSchema = z.object({
  enabled: z.boolean(),
  host: z.string().trim().max(255),
  port: z.number().int().min(1).max(65535),
  security: z.enum(["ssl", "starttls", "none"]),
  username: z.string().trim().max(255),
  password: z.string().max(500).optional(),
  from_name: z.string().trim().min(1).max(100),
  from_email: z.string().trim().email().max(255).or(z.literal("")),
  reply_to: z.string().trim().email().max(255).or(z.literal("")),
  allow_self_signed: z.boolean(),
});

export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.enabled && (!data.host || !data.from_email)) throw new Error("Host and From email are required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row: Record<string, unknown> = {
      id: 1,
      enabled: data.enabled,
      host: data.host || null,
      port: data.port,
      security: data.security,
      username: data.username || null,
      from_name: data.from_name,
      from_email: data.from_email || null,
      reply_to: data.reply_to || null,
      allow_self_signed: data.allow_self_signed,
    };
    if (data.password) row["password"] = data.password;
    const { error } = await supabaseAdmin.from("email_settings").upsert(row as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ to: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { getEmailSettings, sendMail } = await import("./email/smtp.server");
    const { testEmail } = await import("./email/templates.server");
    const s = await getEmailSettings();
    if (!s?.host || !s.from_email) throw new Error("Save your SMTP host and From email first");
    const m = testEmail(requestOrigin());
    await sendMail({ to: data.to, subject: m.subject, html: m.html, kind: "test" }, { settings: s, throwOnError: true });
    return { ok: true };
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ email: z.string().trim().email().max(255), origin: z.string().url().max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sendPasswordReset } = await import("./email/notify.server");
    try {
      await sendPasswordReset(data.email.toLowerCase(), requestOrigin(data.origin));
    } catch (e) {
      console.error("password reset failed", e);
    }
    return { ok: true }; // never reveal whether the email exists
  });
