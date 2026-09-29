import nodemailer from "nodemailer";

export type EmailSettingsRow = {
  id: number;
  enabled: boolean;
  host: string | null;
  port: number;
  security: "ssl" | "starttls" | "none" | string;
  username: string | null;
  password: string | null;
  from_name: string;
  from_email: string | null;
  reply_to: string | null;
  allow_self_signed: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getEmailSettings(): Promise<EmailSettingsRow | null> {
  const db = await admin();
  const { data } = await db.from("email_settings").select("*").eq("id", 1).maybeSingle();
  return (data as EmailSettingsRow | null) ?? null;
}

export function isUsable(s: EmailSettingsRow | null): s is EmailSettingsRow {
  return !!s && s.enabled && !!s.host && !!s.from_email;
}

/** Build a Nodemailer transport that works with shared-hosting SMTP (cPanel, Plesk, etc.) */
export function createTransport(s: EmailSettingsRow) {
  const security = s.security === "starttls" || s.security === "none" ? s.security : "ssl";
  return nodemailer.createTransport({
    host: s.host!,
    port: s.port || (security === "ssl" ? 465 : 587),
    secure: security === "ssl",
    requireTLS: security === "starttls",
    ignoreTLS: security === "none",
    auth: s.username ? { user: s.username, pass: s.password ?? "" } : undefined,
    tls: {
      rejectUnauthorized: !s.allow_self_signed,
      servername: s.host!,
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 25_000,
  });
}

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  kind: string;
  orderId?: string | null;
};

async function log(a: SendArgs, status: "sent" | "failed" | "skipped", error?: string) {
  try {
    const db = await admin();
    await db.from("email_log").insert({
      kind: a.kind,
      recipient: a.to,
      subject: a.subject,
      status,
      error: error?.slice(0, 1000) ?? null,
      order_id: a.orderId ?? null,
    });
  } catch {
    /* logging must never break sending */
  }
}

/** Sends one email. Never throws unless `throwOnError` is set. */
export async function sendMail(a: SendArgs, opts: { settings?: EmailSettingsRow; throwOnError?: boolean } = {}) {
  const s = opts.settings ?? (await getEmailSettings());
  if (!opts.settings && !isUsable(s)) {
    await log(a, "skipped", "Email (SMTP) is not configured or switched off");
    return { sent: false as const, reason: "not_configured" };
  }
  try {
    const t = createTransport(s!);
    await t.sendMail({
      from: { name: s!.from_name || "Usikose360", address: s!.from_email! },
      replyTo: s!.reply_to || undefined,
      to: a.to,
      subject: a.subject,
      html: a.html,
      text: a.text ?? htmlToText(a.html),
    });
    t.close();
    await log(a, "sent");
    return { sent: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await log(a, "failed", msg);
    if (opts.throwOnError) throw new Error(msg);
    return { sent: false as const, reason: msg };
  }
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
