# Rent Manager

A full-stack rental property management web app to replace the physical notebook. Tracks tenants, monthly rent, utility bills, deposits, maintenance expenses, and generates financial reports.

## Tech Stack

- **Framework**: Next.js 14 (App Router) + React
- **Database**: SQLite via Prisma v6
- **UI**: Tailwind CSS v4, shadcn/ui, Radix UI, Lucide Icons
- **Forms**: React Hook Form + Zod v3
- **Charts**: Recharts
- **Utilities**: date-fns, Sonner (toasts)

## Features

- **Dashboard** — Monthly overview, collection stats, overdue alerts, auto bill generation with 12-month backfill
- **Rooms** — Manage rooms, floors, rent, room-level recurring charges (applies to all tenants in that room)
- **Tenants** — Full lifecycle (move-in/move-out), deposits, credit balance, tenant-specific recurring charges, one-time charges
- **Payments** — Monthly bill tracking (PENDING / PARTIAL / PAID / OVERDUE), paid date, multi-month distribution, one-time charge settlement
- **Expenses** — Categorized building expenses (plumbing, electrical, painting, etc.)
- **Reports** — Annual & monthly financial summaries, collection rates, net income (includes one-time charges)
- **Settings** — Currency symbol, code, and locale — stored in DB, applied everywhere

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

```bash
npx prisma migrate dev
```

### 3. Run the dev server

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000)

## All Commands

### Development

| Command | Description |
|---|---|
| `npm run dev` | Start development server at localhost:3000 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

### Database

| Command | Description |
|---|---|
| `npx prisma migrate dev` | Apply pending migrations (creates DB if missing) |
| `npx prisma migrate reset` | Drop all data, re-run migrations, then run seed |
| `npx prisma migrate reset --skip-seed` | Drop all data, re-run migrations, no seed (clean slate) |
| `npm run db:seed` | Seed DB with sample rooms, tenants, and payments |
| `npm run db:studio` | Open Prisma Studio GUI at localhost:5555 |

### Fresh Start Scenarios

**Clean slate — no sample data:**
```bash
npx prisma migrate reset --skip-seed
```

**Fresh start with sample data (rooms, tenants, payments):**
```bash
npx prisma migrate reset
# or, if DB already exists and you just want to reseed:
npm run db:seed
```

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./dev.db"
```

## Project Structure

```
rent-manager/
├── app/
│   ├── api/                  # REST API routes
│   │   ├── payments/         # GET, PUT (record/distribute), DELETE (void)
│   │   ├── tenants/          # CRUD + recurring charges per tenant
│   │   ├── rooms/            # CRUD + room-level recurring charges
│   │   ├── one-time-charges/ # Ad-hoc charges (GET with filters, POST)
│   │   ├── expenses/         # Building expenses
│   │   └── settings/         # Currency settings (GET/PUT)
│   ├── page.tsx              # Dashboard
│   ├── rooms/                # Room management
│   ├── tenants/              # Tenant management
│   ├── payments/             # Payment tracking + record payment flow
│   ├── expenses/             # Expense management
│   ├── reports/              # Financial reports
│   └── settings/             # App settings (currency)
├── components/
│   ├── layout/sidebar.tsx    # Main navigation
│   └── ui/                   # Reusable UI components
├── lib/
│   ├── prisma.ts             # Prisma client singleton
│   ├── settings.ts           # Cached server-side settings helper
│   └── utils.ts              # formatCurrency, formatMonth, currentMonth, etc.
├── prisma/
│   ├── schema.prisma         # Database schema
│   ├── seed.ts               # Sample data seeder
│   └── dev.db                # SQLite database file
└── prisma.config.ts          # Prisma configuration
```

## Database Schema

| Model | Purpose |
|---|---|
| `Room` | Rooms with floor, rent amount |
| `Tenant` | Tenant info, move-in/out dates, deposit, credit balance |
| `Payment` | Monthly rent records per tenant (PENDING/PARTIAL/PAID/OVERDUE) |
| `RecurringCharge` | Recurring costs added to monthly bills — room-level (`tenantId = null`) or tenant-specific; supports `effectiveFrom` (YYYY-MM) to gate when a charge starts applying |
| `OneTimeCharge` | Ad-hoc charges billed to a specific tenant (electricity readings, repairs, etc.) |
| `Expense` | Building maintenance expenses with categories |
| `Setting` | Key-value store for app configuration (currency symbol, currency code) |

## Payment Logic

- **Bill generation** — On dashboard load, bills are created/updated for all active tenants going back 12 months (or move-in date, whichever is more recent). Unpaid bills are recalculated when recurring charges change.
- **Payment distribution** — Entering a payment amount distributes it oldest-first across all unpaid months. Any excess becomes credit balance.
- **One-time charges** — Can be settled via the "Record Payment" page. When "Also apply to one-time charges" is checked, one-time charges are cleared first (oldest-first), then remaining funds go to rent months.
- **Void** — Reverses a payment back to unpaid state (PENDING or OVERDUE depending on month).
- **Pre-fill** — The amount field on the pay page is pre-filled with the exact total outstanding (all unpaid rent + all unpaid one-time charges) to avoid floating-point spillover.

## Notes

- Default currency is NPR (रू). Change it anytime from the **Settings** page — supports NPR, INR, USD, EUR, GBP, or any custom symbol.
- Currency preference is stored in the database and applied across all pages.
- Months are stored as `YYYY-MM` strings; calendar is full AD (Gregorian).
- Prisma v6 is used (not v7) — v7 requires driver adapters for SQLite.
- Zod v3 is used (not v4) — v4 breaks react-hook-form resolver types.
