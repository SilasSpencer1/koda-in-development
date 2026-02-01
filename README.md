# Koda — Social Calendar + Discover

Koda is a privacy-first social calendar that helps friends coordinate plans and discover things to do in their city. Share availability safely (busy-only or full details), invite friends to hangouts, host public events with optional anonymity, and sync with Google Calendar.

---

## Key Features (MVP)
- **Calendar**: week/day/month views, agenda list
- **Friends**: requests, accept/decline, block/unfriend
- **Privacy-first sharing**:
  - private accounts
  - per-friend calendar sharing rules
  - “Busy” cover events (hide titles/details)
- **Events + Invites**:
  - create group or 1:1 events
  - RSVP (Going/Declined)
  - attendee-controlled **anonymity** for public events (host cannot override)
- **Public events** (Partiful-like):
  - join requests + host approval
  - attendee list respects anonymity
- **Discover**:
  - city-based suggestions for open time slots
  - validates “is the venue open then?”
- **Google Calendar integration**:
  - connect account
  - 2-way sync with loop prevention (mapping + etags)
- **Free-tier infra**: railway + Supabase + Upstash + GitHub Actions cron

---

## Tech Stack (Free-tier Friendly)
- **Frontend / Backend**: Next.js (App Router) + TypeScript
- **DB**: Supabase Postgres + Prisma
- **Auth**: NextAuth/Auth.js + Google OAuth
- **Storage**: Supabase Storage (avatars/images)
- **Caching / Rate limit**: Upstash Redis (free tier)
- **Background jobs**: GitHub Actions scheduler → secured API route
- **Email**: Resend (free tier)
- **Analytics / Errors**: PostHog + Sentry (free tiers)
- **Suggestions** (free APIs):
  - Ticketmaster Discovery API (events)
  - OpenStreetMap (Overpass + Nominatim) (places + best-effort hours)

---

## Repo Structure

- `app/` — Next.js App Router pages + layouts (UI)
- `app/api/` — Next.js route handlers (API)
- `components/` — shared UI components (shadcn/ui + custom)
- `lib/`
  - `auth/` — NextAuth/Auth.js config + session helpers
  - `db/` — Prisma client + DB utilities
  - `policies/` — privacy + authorization rules (friend sharing, busy-only)
  - `google/` — Google Calendar sync modules (pull/push, mapping, loop prevention)
  - `discover/` — suggestions pipeline (Ticketmaster + OSM) + ranking
  - `rateLimit/` — Upstash Redis rate limiting utilities
  - `jobs/` — job runner + idempotency helpers
- `prisma/`
  - `schema.prisma` — data model
  - `migrations/` — Prisma migrations
  - `seed.ts` — seed script for local/demo data
- `tests/` — unit/integration tests
- `e2e/` — Playwright end-to-end tests (smoke flows)
- `docs/` — sprint plan, diagrams, notes

---

## Requirements

- Node.js 18+ (20+ recommended)
- pnpm (recommended) or npm/yarn
- Supabase project (Postgres + optional Storage)
- Upstash Redis database (optional but recommended)
- Google Cloud OAuth credentials (for Google Calendar sync)
