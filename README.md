# Windsurf

Appointment scheduling for solo service businesses. Hosts manage event types and availability; guests book (and optionally pay) via a public link.

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

Without Neon, the app uses **SQLite** at `./data/windsurf.db` (`SQLITE_PATH`). No Docker or Postgres required for local development.

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

## What works without Stripe / Resend

- Sign up / sign in, Free plan defaults
- Event types, availability, bookings CRUD
- Public pages `/{username}` and `/{username}/{event-slug}`
- **Free bookings** confirm immediately; emails are logged
- **Plan upgrade** and **Connect onboarding** use `/api/stripe/mock-complete` when keys are missing
- **Paid / tip / deposit** create a pending booking then redirect through the same mock completer

With real Stripe keys + price IDs + webhook secret, Checkout and `POST /api/stripe/webhook` run for real.

## Plan limits (enforced)

| | Free | Pro | Expert |
| --- | --- | --- | --- |
| Event types | 1 | 5 | Unlimited |
| Bookings / month | 10 | 100 | Unlimited |
| Paid / tips / deposits | No | Yes | Yes |
| Custom branding | No | No | Yes |

## Out of scope (v1)

Calendar sync, teams, app store, video integrations, Cloudflare Workers hosting.
