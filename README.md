# Rent Manager

A full-stack rental property management system built to replace the physical notebook. Manage tenants, rooms, monthly rent, utility charges, maintenance expenses, and financial reports — all from a clean web UI. Includes a separate **Tenant Portal** where tenants can view their own rent and payment history via a personal magic link.

---

## Screenshots

> Admin dashboard · Tenant detail · Tenant portal

---

## Features

### Owner / Admin
| Area | What it does |
|---|---|
| **Dashboard** | Monthly collection overview, overdue alerts, auto bill generation with full backfill |
| **Rooms** | Manage rooms, floors, base rent, room-level recurring charges |
| **Tenants** | Full lifecycle — move-in, move-out, deposit, advance credit, notes |
| **Recurring Charges** | Room-level or tenant-specific, with `effectiveFrom` date gating |
| **Payments** | Monthly bills with PENDING / PARTIAL / PAID / OVERDUE statuses, oldest-first distribution, void support |
| **One-time Charges** | Ad-hoc charges (electricity, repairs) with partial payment support |
| **Expenses** | Categorized building maintenance expenses |
| **Reports** | Annual & monthly financial summaries, collection rates, net income, CSV export |
| **WhatsApp Notifications** | Send payment due / overdue reminders via WhatsApp Web; automatic daily overdue reminders at a configured hour |
| **Settings** | Currency symbol/code, WhatsApp message templates, reminder schedule |
| **Receipts** | Printable payment receipts for tenants |

### Tenant Portal (modular, attach/detach via env flag)
| Area | What it does |
|---|---|
| **Dashboard** | Total outstanding balance front and center, pending months list, recent paid history |
| **Payments** | Full payment history with status badges and receipt links |
| **Charges** | One-time charge history with balance breakdown |
| **Profile** | Tenancy details — room, move-in date, deposit, advance credit |
| **Access** | Magic link auth (no password), 30-day sliding sessions, instant revocation by owner |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Database | SQLite via Prisma v6 (MySQL-ready — see deployment) |
| Styling | Tailwind CSS v4 |
| UI Components | Radix UI, Lucide Icons, Sonner (toasts) |
| Forms | React Hook Form + Zod v3 |
| Charts | Recharts |
| Auth | bcryptjs (admin), magic link tokens (tenant portal) |
| Notifications | whatsapp-web.js |
| PDF / Export | @react-pdf/renderer, JSZip, CSV |

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/Susansujakhu/AI-Rent-Management.git
cd rent-manager
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="file:./dev.db"

# Tenant Portal — set to "true" to enable /portal/* routes
TENANT_PORTAL_ENABLED="true"
```

### 3. Set up the database

```bash
npx prisma generate
npx prisma db push
```

### 4. Run the dev server

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000)

On first run, go to `/signup` to create your admin account. Only one admin account is allowed — subsequent signups are blocked.

---

## All Commands

### Development

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:studio` | Open Prisma Studio at localhost:5555 |

### Database

| Command | Description |
|---|---|
| `npx prisma generate` | Regenerate Prisma client after schema changes |
| `npx prisma db push` | Sync schema to database (no migration history) |
| `npx prisma migrate dev` | Create and apply a named migration |
| `npm run db:seed` | Seed with sample rooms, tenants, and payments |

---

## Tenant Portal

The tenant portal is a fully isolated module — tenants access their account via a personal magic link sent by the owner (via WhatsApp or copy-paste). No password required.

### How it works

1. Go to any tenant's detail page in the admin
2. Scroll to the **Tenant Portal Access** card
3. Click **Enable Portal Access** — a personal link is generated
4. Send via WhatsApp or copy the link manually
5. Tenant opens the link → session is created → they land on their dashboard

### Security
- Tokens are 32-byte cryptographically random hex strings
- Sessions are httpOnly cookies, 30-day sliding expiry
- Revoking access immediately invalidates all active sessions
- All portal API routes get `tenantId` from the server session — never from URL params
- Rate-limited token exchange (10 attempts / 5 min per IP)
- Feature-flagged: set `TENANT_PORTAL_ENABLED="false"` to return 404 on all portal routes

### Detaching the module

To fully remove the tenant portal:
1. Delete `app/(tenant-portal)/`
2. Delete `app/api/portal/`
3. Delete `lib/tenant-auth.ts`
4. Remove the portal section from `middleware.ts`
5. Remove `portalEnabled`, `portalToken`, `TenantSession` from `prisma/schema.prisma`

---

## Deploying to cPanel (MySQL)

The app ships with SQLite for local development. For cPanel hosting with MySQL:

### 1. Export your SQLite data

```bash
node scripts/export-to-mysql.mjs > export.sql
```

### 2. Set up MySQL on cPanel

- Go to cPanel → **MySQL Databases**
- Create a database, user, and assign full privileges
- Note the connection details

### 3. Switch to MySQL schema

```bash
cp prisma/schema.mysql.prisma prisma/schema.prisma
```

### 4. Update `.env`

```env
DATABASE_URL="mysql://username:password@localhost:3306/dbname"
```

### 5. Push schema & import data

```bash
npx prisma generate
npx prisma db push
```

Then in **phpMyAdmin** → select your database → **Import** → upload `export.sql`.

### 6. Build & deploy

```bash
npm run build
npm start
```

> Your cPanel host must support **Node.js** (look for "Setup Node.js App" in cPanel). SQLite local dev continues to work unchanged — the export script reads your live data and the MySQL schema file is separate from the default SQLite one.

---

## Project Structure

```
rent-manager/
├── app/
│   ├── (tenant-portal)/
│   │   └── portal/               # Tenant-facing portal (modular)
│   │       ├── _components/      # PortalShell (responsive sidebar + bottom nav)
│   │       ├── dashboard/        # Outstanding balance, pending months, recent paid
│   │       ├── payments/         # Payment history + receipt pages
│   │       ├── charges/          # One-time charge history
│   │       ├── profile/          # Tenancy info
│   │       └── t/[token]/        # Magic link → session → redirect
│   ├── api/
│   │   ├── auth/                 # Login, signup, logout (admin)
│   │   ├── portal/               # Tenant portal APIs (session-scoped, read-only)
│   │   ├── payments/             # Pay, bulk-pay, generate, void
│   │   ├── tenants/              # CRUD, portal enable/disable
│   │   ├── rooms/                # CRUD + recurring charges
│   │   ├── one-time-charges/     # Ad-hoc charges
│   │   ├── expenses/             # Building expenses
│   │   ├── reports/              # Financial summaries + CSV export
│   │   ├── settings/             # App configuration
│   │   ├── backup/               # DB backup download
│   │   └── whatsapp/             # WhatsApp status + notification send
│   ├── page.tsx                  # Admin dashboard
│   ├── tenants/                  # Tenant list + detail + edit
│   ├── rooms/                    # Room list + detail
│   ├── payments/                 # Payment recording flow
│   ├── expenses/                 # Expense management
│   ├── reports/                  # Financial reports
│   └── settings/                 # App settings
├── components/
│   ├── layout/                   # AppShell, Sidebar, Header
│   └── ui/                       # Reusable UI primitives
├── lib/
│   ├── prisma.ts                 # Prisma client singleton
│   ├── auth.ts                   # Admin session management (sliding expiry)
│   ├── tenant-auth.ts            # Tenant session management
│   ├── rate-limit.ts             # In-memory rate limiter
│   ├── scheduler.ts              # Daily overdue reminder scheduler
│   ├── whatsapp.ts               # WhatsApp Web client
│   ├── settings.ts               # Cached settings helper
│   └── utils.ts                  # formatCurrency, formatDate, formatMonth
├── prisma/
│   ├── schema.prisma             # SQLite schema (default / local dev)
│   ├── schema.mysql.prisma       # MySQL schema (cPanel deployment)
│   └── seed.ts                   # Sample data seeder
├── scripts/
│   └── export-to-mysql.mjs      # SQLite → MySQL data export script
├── middleware.ts                 # Edge-safe auth guard + portal feature flag
└── instrumentation.ts           # Server startup: WhatsApp init + scheduler
```

---

## Database Schema

| Model | Purpose |
|---|---|
| `Room` | Rooms with floor, base monthly rent |
| `Tenant` | Tenant info, move-in/out, deposit, credit balance, portal access |
| `Payment` | Monthly rent records (PENDING / PARTIAL / PAID / OVERDUE) |
| `RecurringCharge` | Room-level or tenant-specific recurring additions to monthly bills |
| `OneTimeCharge` | Ad-hoc charges billed to a tenant |
| `Expense` | Building maintenance expenses by category |
| `Setting` | Key-value config store (currency, WhatsApp templates, scheduler) |
| `User` | Single admin account |
| `Session` | Admin sessions (30-day sliding) |
| `TenantSession` | Tenant portal sessions (30-day sliding, revocable) |

---

## Payment Logic

- **Bill generation** — On tenant page load, bills are auto-created from move-in month to current month. Past unpaid bills are marked OVERDUE.
- **Pro-rata first month** — If a tenant moves in mid-month, the first bill is prorated by days occupied.
- **Oldest-first distribution** — Payments distribute across unpaid months from oldest to newest. Any surplus becomes advance credit.
- **Advance credit** — Automatically applied to the next unpaid bill on tenant page load.
- **Recurring charges** — Added to each month's `amountDue` based on `effectiveFrom`. Recalculated whenever charges change.
- **Void** — Reverses a payment back to PENDING/OVERDUE. Credit balance is adjusted accordingly.

---

## Security Highlights

- bcrypt password hashing (12 rounds) with transparent SHA-256 legacy migration
- Constant-time dummy bcrypt compare to prevent timing attacks on login
- In-memory rate limiting on login and portal token exchange
- Session sliding expiry — sessions auto-renew when < 7 days remain
- CSV injection prevention (`'` prefix on formula-starting values)
- Backup endpoint requires `?confirm=1` query param
- All portal data scoped to `tenantId` from server session — URL params never trusted
- ALLOWED_SETTING_KEYS allowlist prevents arbitrary key writes

---

## Notes

- Default currency is NPR (रू) — change anytime from **Settings**
- Months stored as `YYYY-MM` strings, Gregorian calendar
- Prisma v6 used (not v7 — v7 requires driver adapters for SQLite)
- Zod v3 used (not v4 — v4 breaks react-hook-form resolver types)
- WhatsApp integration uses whatsapp-web.js (scan QR on first run)
