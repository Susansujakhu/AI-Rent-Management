# EasyRent — Rent Manager

A full-stack rental property management web app that replaces the physical rent notebook. Built for landlords with one or many properties — track rooms, tenants, monthly rent, utility charges, expenses, and reports, and let tenants self-serve through a personal portal. Includes a separate **admin (super-admin) panel** for the operator running the SaaS.

Deployed at **[easy-rent.xpertthemes.com](https://easy-rent.xpertthemes.com)**.

---

## At a glance

- **Multi-tenant SaaS** — each landlord has their own isolated data (rooms, tenants, payments, expenses). Phone-OTP signup via WhatsApp.
- **Plans** — `free` (up to 3 rooms), `basic`, `starter`, `pro`. Pro unlocks WhatsApp notifications, CSV exports, tenant portals, and other gated features.
- **Tenant portal** — read-only self-service for tenants via personal cookie-based login (bootstrap link sent via WhatsApp).
- **WhatsApp** — switchable between **Meta Cloud API** (official, paid per message) and **Direct QR mode** (Baileys, free, runs on cPanel).
- **Built for cPanel shared hosting** — runs on a CloudLinux Node.js Selector setup with quirks the deploy scripts handle automatically.

---

## Features

### Landlord (`/dashboard`, `/tenants`, `/payments`, `/reports`, …)

| Area | What it does |
|---|---|
| **Dashboard** | Monthly collection overview, overdue alerts, auto bill generation with full backfill on tenant page load |
| **Rooms** | Manage rooms, floors, base rent, and room-level recurring charges |
| **Tenants** | Full lifecycle — move-in, move-out, deposit, advance credit, notes, documents |
| **Payments** | Monthly bills (PENDING / PARTIAL / PAID / OVERDUE), oldest-first distribution, bulk pay, void support, transaction ledger, **advance credit preview** when overpaying |
| **One-time Charges** | Ad-hoc charges (electricity, repairs) with partial payment support |
| **Expenses** | Categorized building expenses, room-tagged |
| **Maintenance** | Tenant-submitted maintenance requests with status workflow |
| **Electricity** | Meter readings with optional tenant self-submission + auto-accept |
| **Reports** | Annual + monthly financial summaries, YoY comparison, room profitability, top expense categories, **tenant + room filters**, four CSV exports (Summary, Payments, Expenses, Tenants) |
| **WhatsApp Notifications** | Send payment receipts and reminders. Automatic daily overdue reminder scheduler at a configured hour |
| **Receipts** | Printable / shareable PDF receipts (`@react-pdf/renderer`) |
| **Documents** | Per-tenant document storage (PDF / images / Office docs, 10 MB cap, mime allowlist, force-attachment for non-inline-safe types) |
| **Backup / Restore** | One-click JSON backup per user; restore wipes + re-imports the user's data (10 MB cap) |
| **Settings** | Currency symbol, payment QR upload, WhatsApp message templates, scheduler config |

### Tenant Portal (`/portal/dashboard`, `/portal/payments`, …)

| Area | What it does |
|---|---|
| **Dashboard** | Total outstanding balance front and center, pending months list, recent paid history, advance credit |
| **Payments** | Full payment history with status badges, breakdown, receipt links |
| **Charges** | One-time charge history |
| **Electricity** | Submit meter readings (when permitted by the landlord) with photo upload |
| **Maintenance** | Submit maintenance requests + see status |
| **Profile** | Tenancy details — room, move-in date, deposit, advance credit |
| **Access** | Cookie session, 30-day sliding expiry. Bootstrapped from a one-shot link sent via WhatsApp; the URL token is consumed and the user navigates token-free thereafter. Re-sending the link rotates the bootstrap token so old links stop working. |

### Super-Admin (`/admin`)

Only accessible to users with `role = "admin"` in the DB.

| Area | What it does |
|---|---|
| **Users** | List, search by plan / status, manually upgrade or extend subscriptions, view subscription history |
| **Stats** | App-wide totals (landlords, payments, etc.) |
| **WhatsApp** | Toggle between **API mode** (Meta Cloud API) and **Direct mode** (Baileys QR). Direct mode UI shows live QR, connection state, and any init errors |
| **App Settings** | Beta-mode flag, admin contact number, **landing-page hero stats overrides** (empty fields fall back to live actuals) |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, custom Node.js server) + React 19 |
| Database | MySQL (production) / SQLite (local) via Prisma v6 |
| Styling | Tailwind CSS v4 + Radix UI primitives |
| Forms | React Hook Form + Zod v3 |
| Charts | Recharts (with custom dark-mode tooltips) |
| Auth | bcryptjs + DB-backed sessions in httpOnly cookies; phone-OTP via WhatsApp |
| WhatsApp | `@whiskeysockets/baileys` (Direct mode) + Meta Cloud API (REST) |
| PDF / Export | `@react-pdf/renderer`, JSZip, plain CSV |
| File processing | `sharp` (image compression for tenant docs) |
| Hosting target | cPanel shared hosting (CloudLinux Node.js Selector + Phusion Passenger) |

---

## Getting started (local dev)

### 1. Prerequisites
- Node.js 20+
- npm
- A WhatsApp account (only needed to test Direct mode locally)

### 2. Clone & install

```bash
git clone https://github.com/Susansujakhu/AI-Rent-Management.git
cd rent-manager
npm install
```

### 3. Environment variables

Create a `.env` in the project root:

```env
# ── Database ──────────────────────────────────────────────────────
DATABASE_URL="file:./dev.db"

# ── Tenant Portal feature flag ────────────────────────────────────
TENANT_PORTAL_ENABLED="true"

# ── Phone OTP bypass (LOCAL ONLY — never set in production) ───────
# When true (and NODE_ENV != "production"), the OTP `000000` always works.
# instrumentation.ts refuses to boot if this is "true" in production.
BYPASS_PHONE_OTP="true"

# ── Public URL for the app ────────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ── WhatsApp (optional, only for API mode) ────────────────────────
# Direct (QR) mode needs no config beyond admin → WhatsApp → Connect.
# WHATSAPP_PHONE_NUMBER_ID="..."
# WHATSAPP_ACCESS_TOKEN="..."

# ── Cron secret (for /api/cron/cleanup) ───────────────────────────
CRON_SECRET="any-long-random-string"
```

### 4. Set up the DB

```bash
npx prisma db push          # creates the SQLite schema
npx prisma generate         # generates the Prisma client
```

Seed data (optional — sample rooms, tenants, payments):

```bash
npm run db:seed
```

### 5. Run the dev server

```bash
npm run dev
```

App runs at <http://localhost:3000>. Sign up at `/signup` — the first user gets `role = "user"`. To make yourself a super-admin, run:

```bash
sqlite3 dev.db "UPDATE User SET role='admin' WHERE email='your@email.com';"
```

---

## Scripts

```bash
npm run dev          # Next dev server (with HMR)
npm run build        # production build (writes .next/)
npm start            # production server (uses server.js custom entry)
npm run lint         # ESLint
npm run db:studio    # Prisma Studio at :5555
npm run db:migrate   # apply pending migrations to MySQL
npm run db:seed      # seed sample data
```

Two scripts you'll invoke during deploys (not normally during dev):

- `node scripts/check-deps.js` — heals the recurring "node_modules is a real dir / Baileys missing" issue on cPanel. Idempotent.
- `node scripts/sync-prisma.js` — copies the committed Prisma client into the CloudLinux nodevenv after `git reset --hard`.

---

## Deploying to cPanel (production)

This app is built specifically for cPanel shared hosting with the CloudLinux NodeJS Selector. The `.next` build folder is **committed to git** because cPanel doesn't have enough memory to run `next build` on the server.

### One-time setup

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full first-deploy walkthrough — creating the database, configuring the Node.js App, copying the schema, etc.

### Every subsequent deploy (after a code change)

```bash
# Local
npm run build
git add .
git commit -m "your message"
git push origin master

# cPanel server (Terminal)
source ~/nodevenv/easy-rent.xpertthemes.com/20/bin/activate
cd ~/easy-rent.xpertthemes.com
git fetch origin && git reset --hard origin/master
node scripts/check-deps.js     # heals node_modules symlink + WA stack if needed
node scripts/sync-prisma.js
touch tmp/restart.txt           # Passenger graceful restart
```

Wait ~30 s, then verify at the public URL.

### Why these particular hoops

- **CloudLinux NodeJS Selector** requires `node_modules/` to be a symlink to `~/nodevenv/<app>/<ver>/lib/node_modules`. `git reset --hard` or the cPanel "Run NPM Install" button can replace the symlink with a real directory, breaking npm. `check-deps.js` detects and repairs this.
- **`prisma generate` crashes on cPanel** (OpenSSL / EAGAIN). We commit the generated client and `sync-prisma.js` copies it into the nodevenv.
- **Build out of memory** — `next build` needs >2 GB RAM; the shared host has less. Build locally, commit `.next/`, ship it.
- **Passenger workers** — cPanel may spawn multiple Node workers. The WhatsApp Direct module persists its state to `.wa-runtime/state.json` so any worker can read the QR / session even if it isn't the one that opened the socket. A pid liveness check (`process.kill(pid, 0)`) keeps stale state files from a dead worker from confusing a new boot.

---

## WhatsApp integration

### Two modes, switchable from the admin panel

| Mode | How it works | Cost | When to use |
|---|---|---|---|
| **API** | REST calls to `graph.facebook.com/v20.0/<phone_id>/messages` | ~$0.005–0.04 per conversation | Production / scale — official, won't get banned, but requires Meta business setup + approved templates for cold outreach |
| **Direct (QR)** | Baileys WebSocket; scan QR on the admin page | Free | Local dev, MVP, or while waiting on Meta WABA review. Same ban risk as any unofficial WhatsApp client |

The mode is stored in the `GlobalSetting` table (`wa_mode = "api" | "direct"`). All app code goes through `lib/whatsapp.ts:sendWhatsAppMessage(phone, message)` which dispatches to whichever mode is active.

### Direct-mode resilience (lib/whatsapp-direct.ts)

- **Shared state**: status / QR / phone / lastError persisted to `.wa-runtime/state.json` every 20 s + on every change. Non-owner workers read this file when the session GET hits them. Pid is verified live (`process.kill(pid, 0)`) so stale files from a dead process are discarded.
- **Connection-replaced doesn't wipe creds**: WhatsApp sends `connectionReplaced` when a sibling worker takes over. The older code deleted `.wwebjs_auth/system/` in that case — losing the session permanently. We now just yield to the new owner.
- **Owner lock**: `isOtherWorkerOwner()` prevents a second worker from initialising Baileys while another is connected (which would cause the connectionReplaced loop).
- **Error feedback**: init errors (e.g. missing Baileys package) are captured into `lastError` and surfaced in the admin UI instead of silently logging to `stderr.log`.

---

## Security

Hardening applied across the codebase (some recent, all in production):

- **Passwords**: bcrypt (12 rounds), 8-char minimum, 72-byte cap (to defeat bcrypt's silent truncation surprise). Legacy SHA-256 hashes are transparently upgraded on next login.
- **Sessions**: random 32-byte hex, DB-backed, httpOnly + `Secure` + `SameSite=Lax` cookies. Sliding expiry (7 days admin, 30 days tenant portal). Password change kills all other sessions in the same transaction.
- **OTP**: `crypto.randomInt(100000, 1000000)` (CSPRNG, not `Math.random`). 6-digit codes, 15-minute validity. Send is rate-limited per IP; verify is rate-limited per phone (5 attempts / 15 min, cleared on success).
- **Forgot password**: always returns the same `{ ok: true }` regardless of whether the phone matches a real user — no enumeration oracle.
- **CSRF**: middleware requires `Origin` or `Referer` to match `Host` on every mutating `/api/*` request (case-insensitive). Bearer-auth endpoints (`/api/cron/*`) are exempt.
- **IDOR**: every per-resource query uses `findFirst({ where: { id, userId } })` or `findFirst({ where: { id, tenantId } })` — ownership is enforced in the WHERE clause, not as a post-check.
- **Document downloads**: only PDFs and common images can be served inline; everything else is forced to `Content-Disposition: attachment` and `Content-Type: application/octet-stream`. `X-Content-Type-Options: nosniff` on all serves.
- **Backup restore**: 10 MB body cap (Content-Length + raw text), per-user transactional wipe + restore.
- **Tenant portal token**: never lives in the URL after the first click — `/portal/t/<token>` mints a cookie session and 302s to `/portal/dashboard`. `send-link` rotates the token on every send, so leaked URLs become invalid.
- **Raw SQL audit**: every `$queryRaw` / `$executeRaw` usage uses tagged-template `Prisma.sql` form. No `$queryRawUnsafe` anywhere in app code.
- **Production guards**: `instrumentation.ts` refuses to boot if `BYPASS_PHONE_OTP=true && NODE_ENV=production`.

---

## Project structure

```
rent-manager/
├── app/
│   ├── (tenant-portal)/portal/    # Tenant-facing portal (cookie auth)
│   │   ├── _components/           # PortalShell (sidebar + bottom nav)
│   │   ├── dashboard|payments|charges|electricity|maintenance|profile/
│   │   └── t/[token]/             # One-shot bootstrap → cookie → redirect
│   ├── admin/                     # Super-admin panel
│   ├── api/                       # All REST endpoints
│   │   ├── auth/                  # signup, login, logout, OTP, password reset
│   │   ├── admin/                 # super-admin: users, stats, whatsapp, app-settings
│   │   ├── payments/              # CRUD, [id]/notify, bulk-pay, generate
│   │   ├── tenants/[id]/portal/   # enable/disable portal, send-link
│   │   ├── portal/                # tenant portal APIs (session-scoped)
│   │   ├── reports/export/        # CSV exports — Summary, Payments, Expenses, Tenants
│   │   ├── backup/{restore,}/     # JSON backup + restore
│   │   ├── meter-readings/        # Electricity meter readings
│   │   ├── maintenance/           # Maintenance requests
│   │   └── cron/cleanup/          # Bearer-authed expired-session cleanup
│   ├── dashboard|tenants|rooms|payments|expenses|reports|settings/
│   ├── login|signup|forgot-password/
│   └── page.tsx                   # Marketing landing page (auth-aware CTAs)
├── components/
│   ├── tenant-picker.tsx          # Reports page filters
│   ├── room-picker.tsx
│   ├── year-picker.tsx
│   ├── reports-chart.tsx          # Custom dark-mode Recharts tooltip
│   ├── payments-view.tsx          # Sessions + open bills + filters
│   └── …
├── lib/
│   ├── prisma.ts                  # Prisma client singleton
│   ├── auth.ts                    # Landlord session
│   ├── tenant-auth.ts             # Tenant portal session
│   ├── whatsapp.ts                # Mode-switching dispatcher
│   ├── whatsapp-direct.ts         # Baileys client (multi-worker safe)
│   ├── rate-limit.ts              # In-memory per-key rate limiter
│   ├── scheduler.ts               # Daily overdue reminder scheduler
│   ├── plan.ts                    # isPro, plan-gate helpers
│   ├── settings.ts                # Cached settings helper
│   └── utils.ts                   # formatCurrency, formatDate, formatMonth
├── prisma/
│   ├── schema.prisma              # MySQL schema (the deployed one)
│   └── seed.ts                    # Sample data
├── scripts/
│   ├── check-deps.js              # Heals node_modules symlink + WA stack
│   ├── sync-prisma.js             # Restores Prisma client after git reset
│   ├── setup.mjs                  # First-time setup helper
│   └── export-to-mysql.mjs        # SQLite → MySQL data export
├── server.js                      # Custom Node entry (loads instrumentation manually)
├── instrumentation.ts             # Scheduler + WA autostart on boot
├── middleware.ts                  # CSRF + portal feature flag
├── DEPLOYMENT.md                  # First-deploy walkthrough
└── CLAUDE.md                      # Operator runbook (consulted by Claude Code)
```

---

## Database schema (selected models)

| Model | Purpose |
|---|---|
| `User` | Landlord account. Role (`user` / `admin`), plan (`free` / `basic` / `starter` / `pro`), planExpiresAt, phone, email, password |
| `Session` | Landlord sessions (7-day sliding) |
| `Room` | Rooms with floor, base rent. Belongs to a User |
| `Tenant` | Tenant info, move-in/out, deposit, credit balance, portal access. Belongs to a User + optionally a Room |
| `TenantSession` | Tenant portal sessions (30-day sliding) |
| `Payment` | Monthly rent records. PaymentTransaction ledger tracks every change |
| `PaymentTransaction` | Per-payment ledger entries for void/refund traceability |
| `RecurringCharge` | Room-level or tenant-specific recurring additions |
| `OneTimeCharge` | Ad-hoc charges |
| `ChargeTransaction` | Per-charge ledger |
| `Expense` | Building expenses, categorized + room-tagged |
| `MaintenanceRequest` | Tenant-submitted maintenance items |
| `MeterReading` | Electricity readings (pending_review → confirmed/rejected) |
| `TenantDocument` | Per-tenant document storage |
| `Notification` | In-app notifications for landlords |
| `Setting` | Per-user key-value config |
| `GlobalSetting` | App-wide key-value (wa_mode, admin_whatsapp, landing-page stats) |
| `PhoneVerificationToken` | Phone OTPs for signup |
| `PasswordResetToken` | OTPs for password reset |
| `SubscriptionHistory` | Audit log of plan changes |

---

## Notes & conventions

- Default currency is **NPR** (`रू`) — landlord can change in Settings. Lakh / Crore notation used for large numbers.
- Months are stored as `YYYY-MM` strings, Gregorian calendar.
- **Move-in date determines the billing cycle anchor.** A tenant who moved in on the 14th has bills covering 14th-of-month → 14th-of-next-month, not calendar months.
- **Pro-rata first month** — if a tenant moves in mid-month, the first bill is prorated.
- **Oldest-first distribution** — incoming payments clear unpaid months oldest-first; surplus becomes advance credit, not a partial application to next month.
- Prisma **v6** (v7 requires driver adapters for SQLite which complicate seeding).
- Zod **v3** (v4 breaks `react-hook-form` resolver types with `z.coerce.number()`).
- The `.next/` folder **is committed to git** for cPanel deploys. Local devs should never `git add .next/cache/` (it's gitignored).

---

## License

Proprietary — XpertThemes. All rights reserved.
