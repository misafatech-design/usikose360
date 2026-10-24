# Roadmap

## Carried over
- [ ] Admin blog editor (create/edit/publish posts) + sidebar link
- [ ] Admin Terms/Privacy editor + sidebar link
- [ ] Blog link in header; site footer on public pages
- [ ] Landing page visual refresh
- [ ] Single database setup SQL file + deployment guide (env vars, Render/Vercel)

## Ticket transfer & resale
- [x] Database: transfers, listings, trades, chat, dispute, check-in guard
- [ ] My tickets: transfer / sell / my listings / my trades
- [ ] Trade page: timer, seller M-Pesa number, I've paid, release, cancel, dispute, chat
- [ ] Public resale marketplace page + resale section on event page
- [ ] Organizer controls: resale on/off and price cap per event
- [ ] Admin orders page with "mark paid" + resend emails
- [ ] Admin disputes page

## Gate passes & admission stats
- [x] Database: gate passes (email + secret code), admission log, who-admitted columns
- [ ] Host creates gate passes on manage page
- [ ] Public /gate page: enter email + code, scan/admit without an account
- [ ] Host stats: who admitted, how many, which ticket; live admission log

## Deployment
- [ ] Automatic database migrations during Vercel/Render build
- [ ] Env-name fallbacks (Vercel Supabase integration names), browser/server same project
- [ ] vercel.json / render.yaml + DEPLOYMENT.md
