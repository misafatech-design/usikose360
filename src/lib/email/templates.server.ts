/* Responsive, inline-styled email templates (table layout for Outlook/Gmail). */

const BRAND = "#2563eb";
const DARK = "#0b1220";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

export const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const kes = (n: number) => `KES ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  }).format(new Date(iso));
}

export function button(href: string, label: string, variant: "primary" | "ghost" = "primary") {
  const bg = variant === "primary" ? BRAND : "#ffffff";
  const fg = variant === "primary" ? "#ffffff" : BRAND;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;"><tr><td style="border-radius:10px;background:${bg};border:1px solid ${BRAND};">
<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${fg};text-decoration:none;border-radius:10px;">${esc(label)}</a>
</td></tr></table>`;
}

export function layout(o: { origin: string; preheader: string; title: string; body: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${esc(o.title)}</title>
<style>@media (max-width:600px){.wrap{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}.stack{display:block!important;width:100%!important;text-align:left!important}.qr{margin-top:14px!important}}</style></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">
<tr><td class="px" style="background:${DARK};padding:22px 32px;background-image:linear-gradient(135deg,#0b1220 0%,#0f2a5c 60%,#1d4ed8 100%);">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><img src="${esc(o.origin)}/favicon.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:8px;"></td>
<td style="vertical-align:middle;padding-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:.3px;">Usikose<span style="color:#38bdf8;">360</span></td>
</tr></table></td></tr>
<tr><td class="px" style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:${DARK};font-size:15px;line-height:1.6;">${o.body}</td></tr>
<tr><td class="px" style="padding:20px 32px;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};line-height:1.5;">
You're receiving this because of activity on your Usikose360 account.<br>
<a href="${esc(o.origin)}" style="color:${BRAND};text-decoration:none;">${esc(o.origin.replace(/^https?:\/\//, ""))}</a> &middot; Kenya's home for events
</td></tr></table></td></tr></table></body></html>`;
}

const h1 = (t: string) =>
  `<h1 style="margin:0 0 8px;font-size:24px;line-height:1.3;color:${DARK};">${t}</h1>`;
const p = (t: string, muted = false) =>
  `<p style="margin:0 0 16px;color:${muted ? MUTED : DARK};">${t}</p>`;

export type EventInfo = { title: string; starts_at: string; venue: string | null; city: string };
export type TicketInfo = { code: string; type: string; attendee: string | null; email?: string | null };

function eventBlock(e: EventInfo) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid ${BORDER};border-radius:12px;margin:0 0 20px;"><tr><td style="padding:16px 18px;">
<div style="font-size:17px;font-weight:bold;color:${DARK};">${esc(e.title)}</div>
<div style="font-size:14px;color:${MUTED};margin-top:4px;">&#128197; ${esc(fmtDate(e.starts_at))}</div>
<div style="font-size:14px;color:${MUTED};">&#128205; ${esc(e.venue ? `${e.venue}, ${e.city}` : e.city)}</div>
</td></tr></table>`;
}

export function ticketCard(origin: string, e: EventInfo, t: TicketInfo) {
  const qr = `${origin}/api/public/qr?d=${encodeURIComponent(t.code)}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:14px;margin:0 0 14px;border-left:6px solid ${BRAND};"><tr>
<td class="stack" style="padding:16px 18px;vertical-align:top;">
<div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND};font-weight:bold;">${esc(t.type)}</div>
<div style="font-size:16px;font-weight:bold;margin-top:4px;color:${DARK};">${esc(e.title)}</div>
<div style="font-size:13px;color:${MUTED};margin-top:4px;">${esc(fmtDate(e.starts_at))}</div>
<div style="font-size:13px;color:${MUTED};">${esc(e.venue ? `${e.venue}, ${e.city}` : e.city)}</div>
<div style="font-size:13px;margin-top:10px;color:${DARK};">Attendee: <strong>${esc(t.attendee || "Guest")}</strong></div>
<div style="font-family:'Courier New',monospace;font-size:18px;font-weight:bold;letter-spacing:3px;margin-top:6px;color:${DARK};">${esc(t.code)}</div>
</td>
<td class="stack qr" width="140" align="center" style="padding:16px;vertical-align:middle;">
<img src="${esc(qr)}" width="120" height="120" alt="QR ${esc(t.code)}" style="display:block;border:0;margin:0 auto;">
<div style="font-size:11px;color:${MUTED};margin-top:6px;">Scan at the gate</div>
</td></tr></table>`;
}

export function orderConfirmationEmail(o: {
  origin: string;
  buyerName: string;
  event: EventInfo;
  lines: { name: string; qty: number; price: number }[];
  total: number;
  receipt: string | null;
  reference: string | null;
  tickets: TicketInfo[];
  pdfUrl: string;
  newAccount: boolean;
}) {
  const rows = o.lines
    .map(
      (l) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${BORDER};">${esc(l.name)} &times; ${l.qty}</td>
<td align="right" style="padding:8px 0;border-bottom:1px solid ${BORDER};">${esc(kes(l.price * l.qty))}</td></tr>`,
    )
    .join("");
  const body = `${h1("You're going! &#127881;")}
${p(`Hi ${esc(o.buyerName || "there")}, your order is confirmed. Your tickets are below and attached as a downloadable PDF.`)}
${eventBlock(o.event)}
<div style="font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${MUTED};margin:0 0 6px;">Order summary</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;margin:0 0 6px;">${rows}
<tr><td style="padding:10px 0;font-weight:bold;">Total</td><td align="right" style="padding:10px 0;font-weight:bold;font-size:16px;color:${BRAND};">${esc(kes(o.total))}</td></tr></table>
${o.receipt ? p(`M-Pesa receipt: <strong>${esc(o.receipt)}</strong>`, true) : ""}
${o.reference ? p(`Order reference: ${esc(o.reference)}`, true) : ""}
${button(o.pdfUrl, "Download tickets (PDF)")}
<div style="height:14px"></div>
<div style="font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${MUTED};margin:0 0 10px;">Your tickets (${o.tickets.length})</div>
${o.tickets.map((t) => ticketCard(o.origin, o.event, t)).join("")}
${o.newAccount ? p(`We've created a Usikose360 account for you so you can find these tickets any time. Check your inbox for a separate email to set your password.`, true) : button(`${o.origin}/tickets`, "View my tickets", "ghost")}`;
  return {
    subject: `Your tickets for ${o.event.title}`,
    html: layout({ origin: o.origin, preheader: `Order confirmed — ${o.tickets.length} ticket(s) for ${o.event.title}`, title: "Order confirmed", body }),
  };
}

export function attendeeTicketEmail(o: {
  origin: string;
  attendeeName: string;
  buyerName: string;
  event: EventInfo;
  tickets: TicketInfo[];
  pdfUrl: string;
}) {
  const body = `${h1("Here's your ticket")}
${p(`Hi ${esc(o.attendeeName || "there")}, ${esc(o.buyerName || "someone")} got you ${o.tickets.length > 1 ? `${o.tickets.length} tickets` : "a ticket"} for this event. Show the QR code at the entrance.`)}
${eventBlock(o.event)}
${o.tickets.map((t) => ticketCard(o.origin, o.event, t)).join("")}
${button(o.pdfUrl, "Download ticket (PDF)")}`;
  return {
    subject: `Your ticket for ${o.event.title}`,
    html: layout({ origin: o.origin, preheader: `Your e-ticket for ${o.event.title}`, title: "Your ticket", body }),
  };
}

export function setPasswordEmail(o: { origin: string; name: string; link: string }) {
  const body = `${h1("Welcome to Usikose360")}
${p(`Hi ${esc(o.name || "there")}, we created an account for you with your ticket purchase. Set a password to sign in and see all your tickets in one place.`)}
${button(o.link, "Set my password")}
${p(`This link expires in 1 hour. If it expires, use "Forgot password" on the sign-in page.`, true)}`;
  return {
    subject: "Set your Usikose360 password",
    html: layout({ origin: o.origin, preheader: "Your account is ready — set a password", title: "Set your password", body }),
  };
}

export function passwordResetEmail(o: { origin: string; link: string }) {
  const body = `${h1("Reset your password")}
${p("We received a request to reset the password for your Usikose360 account. Click the button below to choose a new one.")}
${button(o.link, "Reset password")}
${p("This link expires in 1 hour. If you didn't ask for this, you can ignore this email — your password won't change.", true)}`;
  return {
    subject: "Reset your Usikose360 password",
    html: layout({ origin: o.origin, preheader: "Choose a new password", title: "Reset password", body }),
  };
}

export function paymentFailedEmail(o: { origin: string; name: string; eventTitle: string; reason: string; eventUrl: string }) {
  const body = `${h1("Payment not completed")}
${p(`Hi ${esc(o.name || "there")}, your M-Pesa payment for <strong>${esc(o.eventTitle)}</strong> didn't go through, so no tickets were issued.`)}
${p(`Reason: ${esc(o.reason)}`, true)}
${button(o.eventUrl, "Try again")}`;
  return {
    subject: `Payment not completed — ${o.eventTitle}`,
    html: layout({ origin: o.origin, preheader: "Your M-Pesa payment was not completed", title: "Payment not completed", body }),
  };
}

export function testEmail(origin: string) {
  const body = `${h1("SMTP is working &#9989;")}
${p("This test message was sent from your Usikose360 email settings. Ticket, password and payment emails will be delivered using this mail server.")}`;
  return { subject: "Usikose360 test email", html: layout({ origin, preheader: "Your email settings work", title: "Test", body }) };
}
