# FoodFlow — Online Food Ordering System (DBMS Lab)

FoodFlow is a full-stack food ordering application built for the DSU CSE
DBMS Lab (2026–2027): customers browse restaurants and order food,
restaurants manage menus and inventory, delivery partners fulfil orders,
and a Super Admin oversees the platform. The data layer is a normalized
MySQL 8 schema (21 tables) accessed through Prisma, with transactional
checkout, simulated payments, coupons, reviews, favourites, notifications
and audit logging — plus a read-only **DBMS Lab** mode for running SQL
against the live schema.

> Deployment status: this repository is the application source. Deployment
> to Railway (MySQL) and Vercel is documented below but is **not** claimed
> as complete — follow the deployment steps to stand it up.

## Features

- **4 roles** — Customer, Restaurant Admin, Delivery Partner, Super Admin
  (JWT auth, role-guarded API routes).
- **Ordering** — browse restaurants/menus, one-restaurant-per-cart, cart,
  coupons, checkout.
- **Transactional checkout** — order + items (price snapshots) + inventory
  decrement + payment + delivery + status history + cart clear happen in a
  single Prisma transaction.
- **Simulated payments** — COD, UPI (simulated) and card (simulated);
  references are prefixed `SIM-`. No real payment gateway.
- **Delivery flow** — order status state machine
  (`PLACED → CONFIRMED → PREPARING → READY_FOR_PICKUP → PICKED_UP →
  OUT_FOR_DELIVERY → DELIVERED`, with `CANCELLED`/`REJECTED`); invalid
  transitions are rejected.
- **Restaurant ops** — menu and inventory management with low-stock alerts.
- **Reviews, favourites, notifications, audit logs.**
- **DBMS Lab** — read-only SQL runner guarded by `lib/sql-guard.ts`
  (single `SELECT`/`WITH` only, allowlisted tables, `LIMIT` capped at 100),
  schema explorer, and demo queries.
- **Optional AI** — FoodFlow Intelligence (Gemini) is gated by
  `GEMINI_API_KEY`; the app runs fully without it.

## Architecture

```
┌──────────────┐   HTTP/JSON    ┌───────────────────────┐
│  Next.js 15  │ ───────────▶   │  Next.js API routes   │
│  App Router  │                │  (app/api/*)          │
│  (React 19)  │ ◀───────────   │  JWT auth, role guard │
└──────────────┘                └──────────┬────────────┘
                                           │ Prisma Client
                                           ▼
                                ┌───────────────────────┐
                                │  MySQL 8              │
                                │  food_ordering_db     │
                                │  (Railway in prod)    │
                                │  21 tables + views /  │
                                │  procedures / indexes │
                                └───────────────────────┘
```

Money math lives in `lib/utils.ts` (`calcTotals`: 5% tax on the
discounted subtotal). The order state machine lives there too
(`canTransition`). The SQL guard lives in `lib/sql-guard.ts`.

## Project structure

```
foodflow/
├── app/                    # Pages (restaurants, cart, checkout, orders, profile, …)
│   └── api/                # API routes (auth, cart, checkout, orders, delivery,
│                           #   restaurant, admin, lab, …)
├── components/             # React components
├── lib/                    # prisma.ts, auth.ts, http.ts, sql-guard.ts, utils.ts, notify.ts
├── prisma/
│   ├── schema.prisma       # Canonical MySQL schema (source of truth — do not edit lightly)
│   ├── seed.ts             # Deterministic seed (seed=42): demo data + demo accounts
│   ├── advanced-sql/migration.sql   # MySQL-only views/procedures/triggers/indexes
│   └── migrations/                    # Prisma migrations (init)
├── documentation/
│   ├── er-diagram.md / er-diagram.svg
│   ├── relational-schema.md
│   ├── db-objects.md
│   └── DSU-DBMS-Report.md  # Academic report (fill in name/USN/section/date)
├── tests/                  # node:test suites (sql-guard, transitions, checkout-math)
├── package.json
└── .env.example
```

## Prerequisites

- Node.js 20+
- MySQL 8 — either a local server or a Railway MySQL instance
- (Optional) a Gemini API key for the AI features

## Run it on your own machine

> **Important — why a link may "not open":** `http://localhost:3000` only
> works on the machine that is actually running the server. If someone
> else (or a cloud browser) opens that address, there is no server there
> and the page will not load — that does **not** mean the app is broken.
> To run it yourself, follow the steps below on your own computer. To get
> a link anyone can open, deploy it (see [Deployment](#deployment)).

### Prerequisites

- Node.js 20+ and npm
- MySQL 8 — either installed locally, via Docker Compose (below), or a
  Railway MySQL instance
- (Optional) a Gemini API key for the AI features

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start MySQL — pick ONE option:
#    a) Docker (easiest, no local MySQL install needed):
docker compose up -d
#    b) Or use a local MySQL 8 server / Railway MySQL and point
#       DATABASE_URL at it (see the env table below).

# 3. Configure environment (see table below)
cp .env.example .env
#    The shipped .env already works for local dev: its DATABASE_URL
#    matches docker-compose.yml, and AUTH_SECRET is a dev-only default.
#    Change AUTH_SECRET (and the DB password) before production use.
#    If you use your own MySQL/Railway instead of Docker, edit
#    DATABASE_URL in .env to point at it.

# 4. Apply migrations to your database
npx prisma migrate dev        # local development; creates the DB if needed
#    On a fresh empty database, `npx prisma migrate deploy` works too
#    and never prompts.

# 5. Seed demo data (deterministic, safe to re-run)
npm run db:seed

# 6. Start the dev server
npm run dev                   # open http://localhost:3000 in YOUR browser
```

If `npm run dev` says the port is taken, stop the old server first
(`pkill -f "next-server"` on macOS/Linux, or close the other terminal).

### Push to GitHub yourself

The repository is **not** pushed anywhere yet — push it from your machine
with your own repo URL (create an **empty** repo on GitHub first, no
README/.gitignore/license, or the push will be rejected). **Do not run
`git init`**: the project already contains its git history (`.git`), so
`git init` would discard it and start a fresh empty repo instead.

```bash
cd foodflow
git status        # should be clean; .env must NOT appear (it is gitignored)
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

> **Never commit `.env`.** It holds your database password and JWT secret.
> It is already in `.gitignore` — if `git status` shows it, stop and check
> `.gitignore` before committing. Only `.env.example` (placeholders) is
> meant to be committed.

> **Note — Prisma engine download behind a flaky proxy:** `prisma generate`
> downloads the query/schema engine binaries from `binaries.prisma.sh`. If
> that download resets (ECONNRESET / socket hang up) in a restricted
> network, install packages without scripts, fetch the engines with curl
> (which retries cleanly), and copy them into place:
>
> ```bash
> npm install --ignore-scripts
> # Find the engine commit hash (<COMMIT>) from a debug run:
> #   DEBUG="prisma:*" npx prisma generate 2>&1 | grep binaries.prisma.sh
> curl -o /tmp/libquery_engine.so.node.gz "https://binaries.prisma.sh/all_commits/<COMMIT>/debian-openssl-3.0.x/libquery_engine.so.node.gz"
> curl -o /tmp/schema-engine.gz "https://binaries.prisma.sh/all_commits/<COMMIT>/debian-openssl-3.0.x/schema-engine.gz"
> gunzip -c /tmp/libquery_engine.so.node.gz > node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node
> gunzip -c /tmp/schema-engine.gz > node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x
> cp node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node node_modules/prisma/libquery_engine-debian-openssl-3.0.x.so.node
> cp node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x node_modules/prisma/schema-engine-debian-openssl-3.0.x
> npx prisma generate
> ```
>
> **FoodFlow Intelligence without a Gemini key:** `POST /api/ai` works with
> no key — it answers a set of common questions (orders, revenue, popular
> foods, restaurants, stock, payments, deliveries) with pre-validated
> read-only SQL. With `GEMINI_API_KEY` set, questions are sent to Gemini
> server-side and the generated SQL is validated the same way before it runs.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string, e.g. `mysql://user:pass@host:3306/food_ordering_db` |
| `AUTH_SECRET` | Yes | Random 32+ char secret for JWT signing. `.env.example` ships a dev-only default — replace it with your own (`openssl rand -hex 32`) for production. |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL (default `http://localhost:3000`) |
| `GEMINI_API_KEY` | No | Gemini API key for FoodFlow Intelligence; leave blank to run without AI |

Never commit `.env` — it is gitignored.

## Demo accounts

Seeded by `prisma/seed.ts`. **Password for all four: `Demo@1234`.
Local development only — never use these credentials in production.**

| Email | Role | Notes |
|---|---|---|
| `customer@foodflow.in` | CUSTOMER | "Demo Customer" |
| `restaurant@foodflow.in` | RESTAURANT_ADMIN | "Demo Restaurant Owner" — owns **Spice Route** |
| `delivery@foodflow.in` | DELIVERY_PARTNER | "Demo Rider" |
| `admin@foodflow.in` | SUPER_ADMIN | "Demo Admin" |

The seed also creates 25 customers (`customer1@foodflow.in` …),
5 restaurant owners, 10 delivery partners, 10 categories, 5 restaurants,
50 food items, 30 orders, 12 reviews and 4 coupons
(`WELCOME20`, `FOODFLOW50`, `FREEDEL`, `VEG10`). Re-running the seed wipes
and re-creates the data (deterministic, seed = 42).

## API overview

Base: `/api`. Auth uses a JWT cookie; most routes require a logged-in user
and the matching role.

| Group | Routes | Notes |
|---|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | bcrypt passwords, JWT |
| Restaurants | `GET /api/restaurants`, `GET /api/restaurants/[id]` | Public browsing |
| Foods | `GET /api/foods`, `GET /api/foods/[id]` | Menu items |
| Categories | `GET /api/categories` | |
| Cart | `GET/POST /api/cart` | One restaurant per cart |
| Checkout | `POST /api/checkout` | Transactional; idempotency key |
| Coupons | `GET /api/coupons`, `POST /api/coupons/validate` | |
| Orders | `GET /api/orders`, `GET /api/orders/[id]` | Status transitions validated |
| Delivery | `GET /api/delivery/assigned`, `POST /api/delivery/[id]/status` | Partner flow |
| Restaurant | `GET /api/restaurant/orders`, `GET /api/restaurant/stats`, `GET/POST /api/restaurant/inventory` | Admin flow |
| Admin | `GET /api/admin/overview`, `/api/admin/users`, `/api/admin/coupons`, `/api/admin/audit-logs` | Super Admin |
| Reviews / Favourites / Notifications / Addresses | `GET/POST /api/reviews`, `/api/favourites`, `/api/notifications`, `/api/addresses` | |
| DBMS Lab | `GET /api/lab/overview`, `GET /api/lab/tables`, `GET /api/lab/tables/[name]`, `POST /api/lab/query` | Read-only SQL |

## DBMS Lab guide

The Lab (`/api/lab/*`) is the hands-on part of the project:

1. **Explore** — `GET /api/lab/tables` lists all 21 tables; each table's
   columns, keys and row counts are shown.
2. **Query** — `POST /api/lab/query` runs a read-only query. The guard
   (`lib/sql-guard.ts`) allows only a single `SELECT`/`WITH` over
   allowlisted tables/views, blocks INSERT/UPDATE/DELETE/DROP, multiple
   statements and `;` injection, and caps results at 100 rows.
3. **Try the views** —
   `SELECT * FROM v_restaurant_sales ORDER BY revenue DESC;`
   `SELECT * FROM v_popular_foods LIMIT 10;`
   `SELECT * FROM v_monthly_revenue;`
4. **Try the procedures** (MySQL client, not the Lab — the Lab blocks
   `CALL` by design):
   `CALL sp_customer_order_history(1);`
   `CALL sp_restaurant_revenue(1, '2026-11-01', '2026-11-30');`
5. **Advanced objects** — `prisma/advanced-sql/migration.sql`
   adds CHECK constraints, the views/procedures above, two **demo-only**
   triggers and two composite indexes. Read
   [`documentation/db-objects.md`](./documentation/db-objects.md) before
   applying it: the triggers must never be applied together with the app,
   because the app already writes `order_status_history` itself — applying
   both would double-log every status change.

## Deployment

### 1. Push to GitHub

Follow [Push to GitHub yourself](#push-to-github-yourself) above — create
an empty repo, then (no `git init` — the history is already in the folder)
add your remote and push. Never commit `.env`.

### 2. Railway — MySQL

1. Create a Railway project → add a **MySQL** service.
2. Copy its connection string into `DATABASE_URL`.
3. Apply migrations and seed from your machine (or Railway's shell):
   ```bash
   npx prisma migrate deploy
   npm run db:seed        # optional, demo data only
   ```
4. Apply the advanced SQL objects (optional, MySQL only):
   ```bash
   mysql -h <host> -u <user> -p food_ordering_db \
     < prisma/advanced-sql/migration.sql
   ```
   See the header of that file first — the triggers are demo-only.

### 3. Vercel — app

1. Import the GitHub repo in Vercel.
2. Set environment variables: `DATABASE_URL` (Railway MySQL string),
   `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (your Vercel URL),
   `GEMINI_API_KEY` (optional).
3. Deploy. Vercel runs `npm run build` (`prisma generate && next build`).

**Production rules:** use `prisma migrate deploy` in production — never
`prisma migrate dev`. Never run the seed against production. Never use the
demo accounts/password in production.

## Testing

```bash
npm test        # node --test tests/*.test.js
```

The suites are self-contained rule mirrors (plain Node, no TS imports):

- `tests/sql-guard.test.js` — the read-only SQL guard rules.
- `tests/transitions.test.js` — the order status state machine.
- `tests/checkout-math.test.js` — subtotal / 5% tax / delivery /
  coupon-cap math.

## Documentation

- [`documentation/er-diagram.md`](./documentation/er-diagram.md) — ER
  diagram (Mermaid + text, 21 entities) and
  [`er-diagram.svg`](./documentation/er-diagram.svg) — SVG version.
- [`documentation/relational-schema.md`](./documentation/relational-schema.md)
  — table-by-table schema, keys, constraints, normalization (3NF).
- [`documentation/db-objects.md`](./documentation/db-objects.md) — views,
  procedures, triggers, indexes, and the single-source-of-truth decision
  for `order_status_history`.
- [`documentation/DSU-DBMS-Report.md`](./documentation/DSU-DBMS-Report.md)
  — academic lab report (fill in your name, USN, section and date).

## Limitations

- **SQLite fallback:** if MySQL is unavailable locally, verification may
  use a SQLite fallback schema — it does not support the advanced MySQL
  objects (stored procedures, triggers, CHECK constraints). MySQL is the
  canonical database.
- **Simulated payments:** UPI/card payments are simulated; COD is
  cash-on-delivery. No real payment gateway is integrated.
- **No live GPS:** delivery progress is tracked through status changes,
  not real-time location.
- **AI is optional:** Gemini features are gated by `GEMINI_API_KEY` and
  the app works without them.
- **DBMS Lab is read-only:** the SQL runner intentionally rejects
  writes, `CALL`, and multi-statement queries.
