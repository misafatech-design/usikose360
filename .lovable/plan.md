# Event Crew and Vendor Marketplace

## Build
- Email event-specific scan-crew passes with a private invitation link and PIN, while keeping the existing email-plus-PIN scanner login.
- Connect admission totals and the per-ticket scan log to event management, including check-ins performed by the organizer.
- Let organizers enable vendor applications, set event requirements, and create vendor categories with minimum bids and available spaces.
- Add a public vendor application flow. Organizers can review applications and approve a bid or decline it; approved vendors receive a private checkout link.
- Reuse the configured M-Pesa STK prompt and status polling for vendor checkout. Update vendor payment status from callbacks and provide clear pending, failed, and paid states.

## Technical approach
- Add event vendor settings, vendor categories, and vendor applications with owner/admin access for organizer management and narrowly scoped public application/payment access.
- Keep vendor payment and invitation secrets on the server; validate event, category, bid, application token, accepted amount, and M-Pesa result before each state change.
- Use the existing SMTP configuration for scan-crew and vendor emails, and the existing event M-Pesa configuration for vendor checkout.
- Verify the schema, TypeScript/build output, key routes, and checkout/status handling. Do not claim live email or Daraja delivery without provider credentials and a real transaction.

## Not included
- No unrelated admin, resale, homepage, or deployment backlog items.