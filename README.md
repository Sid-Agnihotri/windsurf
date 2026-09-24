# Windsurf

Appointment scheduling for solo service businesses. Hosts manage events and availability; guests book (and optionally pay) via a public link.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind + shadcn/ui
- **Better Auth** — email/password + username
- **Drizzle ORM** — SQLite locally; Neon Postgres-ready (see below)
- **Stripe** — Billing (host subscriptions) + Connect Express (guest → host)
- **Resend** — booking emails (logs to console without `RESEND_API_KEY`)

## Quick start

```bash
npm install
cp .env.example .env.local
# edit BETTER_AUTH_SECRET at minimum

npm run db:generate   # if schema changed
npm run db:migrate    # apply SQL migrations to SQLite
# or: npm run db:push

npm run dev
```

App: [http://127.0.0.1:43123](http://127.0.0.1:43123)

### Local database (default)

Without Neon, the app uses **SQLite** at `./data/windsurf.db` (`SQLITE_PATH`). No Docker or Postgres required — this is what the cloud agent uses.

### Neon / Postgres

1. Create a Neon database and set `DATABASE_URL=postgresql://...`
2. Change `drizzle.config.ts` `dialect` to `postgresql` and point credentials at `DATABASE_URL`
3. Port `src/db/schema.ts` / `src/db/index.ts` to `drizzle-orm/neon-http` or `postgres-js` (same table shapes; auth adapter `provider: "pg"`)
4. Run migrations against Neon

The product schema (users, events, availability, bookings, Stripe ids) is designed to map 1:1 to Postgres.

## Env vars

See `.env.example`:

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Auth |
| `NEXT_PUBLIC_APP_URL` | Absolute URLs for Stripe redirects |
| `SQLITE_PATH` | Local SQLite file |
| `DATABASE_URL` | Neon/Postgres (production) |
| `STRIPE_*` | Billing + Connect + webhooks (optional locally) |
| `RESEND_*` | Transactional email (optional locally) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Continue with Google" + Google Calendar (optional) |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` | "Continue with Microsoft" + Outlook Calendar (optional) |

## What works without Stripe / Resend

- Sign up / sign in, Free plan defaults
- Events, availability, bookings CRUD
- Public pages `/{username}` and `/{username}/{event-slug}`
- **Free bookings** confirm immediately; emails are logged
- **Plan upgrade** and **Connect onboarding** use `/api/stripe/mock-complete` when keys are missing
- **Paid / tip / deposit** create a pending booking then redirect through the same mock completer

With real Stripe keys + price IDs + webhook secret, Checkout and `POST /api/stripe/webhook` run for real.

## Google / Microsoft sign-in and calendar

Set the credentials for a provider and its "Continue with ..." button appears on the sign-in and sign-up pages. `.env.example` lists the redirect URI (`<BETTER_AUTH_URL>/api/auth/callback/google` or `/microsoft`) and the permissions to enable in each console.

- **Signing in creates the account** if there isn't one yet. A public username is generated from the email (editable in Settings) and the user lands on Settings to check it.
- **The calendar is requested at the same time**, so one consent screen covers both. Users can untick it (Google) and connect later under **Settings → Calendar**, which also covers people who signed up with a password.
- **Busy times block slots.** Events on the host's calendar (not marked free, not declined, not cancelled) hide overlapping times on the public page, when a guest confirms, and when rescheduling. Host buffers apply.
- **Bookings are added to the calendar** once confirmed (after payment, for paid ones), moved when rescheduled and removed when cancelled. The event has no attendees, so nobody gets a surprise invite; Windsurf's own emails go to the guest.
- **A calendar problem never blocks a booking.** Failures are logged and skipped; if the calendar can't be read, slots are offered as if it were empty.
- With both providers connected, choose which one to use in Settings; "Pause calendar sync" turns it off without disconnecting.
- A password account with the same email as a Google/Microsoft sign-in is not merged automatically (the password signup email is unverified). The user is told to sign in with their password and connect the provider from Settings.
- Google's `calendar.events` scope is "sensitive": fine for testing with test users, but needs Google's app verification before opening sign-in to the public.

Migration `0004_calendar_sync.sql` adds columns only.

## Demo accounts (dev only)

```bash
npm run db:migrate
npm run db:seed      # safe to re-run; it also resets each account's tier
```

| Email | Password | Username | Plan | Role |
| --- | --- | --- | --- | --- |
| `admin@windsurf.test` | `password` | `admin` | Expert | admin |
| `free@windsurf.test` | `password` | `demo_free` | Free | user |
| `pro@windsurf.test` | `password` | `demo_pro` | Pro | user |
| `expert@windsurf.test` | `password` | `demo_expert` | Expert | user |

The three tier accounts behave like ordinary customers, and they start bare: default Mon–Fri 9–5 availability, no events, bookings or Stripe Connect. Sign in as the **admin** and open **Admin** in the dashboard nav (`/dashboard/admin`) to see every account's usage against its limits and to switch any account's tier without going through Stripe. Everyone else gets a 404 there. `db:seed` refuses to run when `NODE_ENV=production`.

## How payments work

Each event (e.g. "Dog walking", "Car washing") has its own public booking link and its own pricing, in CAD:

- **Free**: no payment.
- **Paid**: full price. The guest pays by card (Stripe) or, if the host turned on **Accept cash**, chooses to pay in person.
- **Deposit**: a deposit is the partial payment, charged by card at booking. The rest of the full price is due in person. If cash is accepted the guest can instead pay everything in person.
- **Tips**: optional, card only.

Cash bookings confirm immediately and show a balance due on the host's Bookings page, with a **Mark paid** button once the money is received. Stripe Connect is only needed for card payments and tips, so a cash-only host can skip it.

## Guest self-service

Every booking made from now on gets a secret manage link (`/booking/manage/{token}`). It is in the guest's confirmation email and on the "You're booked" screen. From it a guest can:

- **Cancel**, or
- **Reschedule** to another open time for the same event (confirmed bookings only; a booking still awaiting payment can only be cancelled).

Hosts set how late guests can do this under **Availability → "Guests can change bookings until (hours before)"** (default 24, `0` = until the appointment starts). Inside that window the page asks the guest to contact the host. Both sides get an email whenever a booking is cancelled or moved, and guests are also emailed when the *host* cancels.

Hosts can also **Reschedule** any upcoming confirmed booking from the Bookings page (the guest cutoff doesn't apply to the host), and the guest is emailed the new time.

Refunds are manual: cancelling never refunds money. The host's email says how much the guest paid, and the guest is told refunds are handled by the host. Bookings created before this feature have no link.

## Plan limits (enforced)

| | Free | Pro | Expert |
| --- | --- | --- | --- |
| Events | 3 | Unlimited | Unlimited |
| Bookings / month | 5 | 100 | Unlimited |
| Paid / tips / deposits (CAD, needs Stripe Connect) | Yes | Yes | Yes |
| Custom branding | No | No | Yes |

## Out of scope (v1)

Teams, app store, video integrations, Cloudflare Workers hosting.
