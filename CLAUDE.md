# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo for **Lost Sierra Kids** (California 501(c)(3)), a community learning center in Graeagle, CA.
- **Static marketing site** at repo root → `lostsierrakids.com`
- **Family portal** (Next.js) in `portal/` → `lostsierrakids.com/portal`
- Hosted on Vercel; `vercel.json` at root routes `/portal/*` to the Next.js app, everything else to static files.

## Common Commands

### Static Site
```bash
npx serve                # Local preview (root directory)
```
No build step — pure HTML/CSS/JS served as-is.

### Portal (run from `portal/`)
```bash
npm run dev              # Dev server on :3000
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Playwright e2e (Desktop Chrome + iPhone 14)
npm run test:mobile      # Playwright iPhone 14 only
npm run db:push          # Push Drizzle schema to Neon Postgres
npm run db:seed          # Seed admin user + programs + academic year
```
**Before `db:push`**: export env vars with `export $(cat .env.local | grep -v '^#' | xargs)`

## Architecture

### Monorepo Routing (vercel.json)
- `/portal/*` → Next.js app (`@vercel/next` build from `portal/package.json`)
- `/css/*`, `/js/*`, `/images/*`, `/photos/*`, `/logos/*`, etc. → static assets
- `/_next/*` → portal static assets (rewrites to `/portal/_next/*`)
- `/*` fallback → `index.html`

### Static Site (`/`)
- `index.html` — single-page with snap-scrolling sections
- `css/styles.css` — CSS variables design system (forest greens, sunlight gold, warm paper tones)
- `js/main.js` — photo carousel (loads from `photos/photos.json`), partner logos (from `logos/logos.json`), bulletin board (fetches from GitHub API with local fallback)
- Fonts: Fraunces (headers) + Source Sans 3 (body)
- Forms use FormSubmit.co → lostsierrakids@gmail.com

### Portal (`portal/`)
- **Framework**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Database**: Neon Postgres via Drizzle ORM (`@neondatabase/serverless`)
- **Auth**: NextAuth v5 beta — Credentials provider, JWT sessions, email verification via Resend
- **Path alias**: `@/*` → `./src/*`

#### Route Groups
- `(auth)` — `/login`, `/register`, `/verify` (public)
- `(dashboard)` — all authenticated routes, role-gated by middleware

#### Role System
Roles: `admin` | `parent` | `new_account` | `new_user`
- `new_user` → can only access dashboard + register-family
- `new_account` → dashboard, register-family, children, family, announcements
- `parent` → all non-admin routes
- `admin` → everything including `/admin/*`

Middleware (`src/middleware.ts`) enforces role access and redirects unverified users to `/verify`.

#### Key Modules
| Path | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth config, JWT callbacks, admin alias handling |
| `src/lib/db/schema.ts` | Drizzle table definitions (users, guardians, children, registrations, enrollments, attendance, announcements, invoices, payments, weekly reports) |
| `src/lib/db/seed.ts` | Seeds admin user, programs (Playgroup/Phase 1/Phase 2), academic year |
| `src/lib/email.ts` | Resend integration, verification code generation |
| `src/lib/validations.ts` | Zod schemas for all form inputs |
| `src/middleware.ts` | Auth + role-based route protection |

#### Auth Notes
- "admin" username maps to thomasdisney7@gmail.com internally
- Admin can authenticate with `ADMIN_PASSWORD` env var or bcrypt hash
- Registration flow: create account → verify email (6-digit code, 15min expiry) → complete family registration
- Auth base path: `/portal/api/auth`

#### Portal Env Vars (in `.env.local`)
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `ADMIN_PASSWORD`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`

## Design System
- **Primary**: Forest greens (`#1e3a2f`, `#2d5446`, `#4a7c67`)
- **Accent**: Sunlight gold (`#e8c46c`)
- **Neutrals**: Warm paper tones (`#faf8f5`, `#f5f1eb`)
- Both static site and portal share this palette and font pairing.

## User Preferences
1. **Always take action** — edit files, commit, and push without asking. No planning mode.
2. **Use frontend-design skill** for polished, modern aesthetics
3. **Mobile-first** — always consider mobile navigation and layout
4. **Clean copy** — concise labels, no verbose text
5. **Compact layouts** — use collapsibles for detail
6. **Modern UX** — snap scrolling, viewport-fit sections

## Git Workflow
- Work on `lsk-production` branch
- Push to main: `git push origin lsk-production:main`
- Vercel auto-deploys on push to main
