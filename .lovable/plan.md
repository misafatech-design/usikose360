# Email system, PDF tickets, guest checkout and password reset

## What you will get
1. **Admin > Email settings page** (admins only)
   - SMTP host, port, security (SSL on 465 / STARTTLS on 587 / none), username, password, "From" name and address, reply-to.
   - Option to accept self-signed certificates (common on shared hosting like cPanel).
   - "Send test email" button, plus a log of recent emails sent and failed.
   - Password is stored on the server only and never shown back in full.
2. **Emails sent through your SMTP with Nodemailer**
   - Order confirmation to the primary buyer (full ticket group, order summary, total in KES).
   - One ticket email per attendee (name, event, date, venue, ticket type, QR code, download button). The primary buyer also gets a copy of every ticket.
   - Welcome / "set your password" email for new guest buyers.
   - Password reset email.
   - Payment failed notice.
   - All templates are mobile-friendly, white background, brand blue accents and the Usikose360 logo.
3. **PDF ticket download**
   - "Download PDF" on the payment success screen, in My tickets and as a link in every ticket email.
   - One page per ticket with QR code, attendee name, event details and ticket code.
4. **Guest checkout**
   - Buyers do not need to sign in. After payment succeeds, an account is created automatically for the primary buyer's email (or linked if it already exists), and their tickets are attached to it.
   - They receive a "Set your password" email; on first sign-in they choose a password.
5. **Forgot password**
   - "Forgot password?" link on the sign-in page, a request page and a "set new password" page.
   - Every link in these emails uses the website address the request came from (your custom domain when used there), never a fixed default address.

## Technical details
- Settings in a new admin-only `email_settings` table (RLS: admins read/write, password column never returned to the browser) and an `email_log` table.
- `src/lib/email/smtp.server.ts`: Nodemailer transport (`secure: true` for 465, `requireTLS` for 587, optional `tls.rejectUnauthorized=false`), built per send from stored settings.
- Templates as React Email components rendered to HTML server-side.
- Sends triggered from the M-Pesa success callback / status check (idempotent: a `emails_sent_at` flag on orders).
- Password reset and set-password links generated with the admin client `generateLink({ type: 'recovery', options: { redirectTo: origin + '/reset-password' } })`, where `origin` is passed from `window.location.origin` and checked against the request's Origin header, then emailed via SMTP.
- Guest checkout: STK push server function becomes public for guests, with input validation and rate limiting; account is created with `auth.admin.createUser` (email confirmed) on payment success.
- PDF generated server-side with `pdf-lib` + QR codes (works in the hosting runtime), served from a signed per-order download link.

## Limitation to know
- The hosting environment blocks port 25. SMTP must use port 465 (SSL) or 587 (STARTTLS), which all shared hosts support.
