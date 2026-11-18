# FoodFlow — Online Food Ordering System (DBMS Lab Report)

| Field | Value |
|---|---|
| Student Name | [Your Name] |
| USN | [Your USN] |
| Section | [Your Section] |
| Date | [Date] |
| Course | Database Management Systems Lab (CSE, 2026–2027) |
| Project | FoodFlow — Online Food Ordering, Restaurant Operations, Inventory and Delivery Management |

## 1. Problem Statement

Ordering food online involves many related pieces of data — customers,
restaurants, menus, stock, carts, orders, payments, riders and reviews —
that must stay consistent even when several users act at the same time.
Spreadsheets or ad-hoc files cannot enforce that consistency: an order
could be placed for an out-of-stock dish, a payment could succeed while
the order is lost, or two riders could be assigned the same delivery.
FoodFlow is a web application backed by a relational database (MySQL 8)
that models this domain with proper keys, constraints and transactions,
so the data stays correct by construction.

## 2. Objective

1. Design a normalized relational schema (21 tables) for food ordering.
2. Implement role-based access for four roles: Customer, Restaurant Admin,
   Delivery Partner and Super Admin.
3. Implement cart → checkout → payment → delivery as one atomic flow.
4. Demonstrate advanced SQL: views, stored procedures, triggers and
   indexes, with a clear single-source-of-truth rule for audit history.
5. Provide a DBMS Lab mode in the app for running read-only SQL and
   inspecting the schema.

## 3. Why MySQL

MySQL 8 was chosen because it is a true relational DBMS with ACID
transactions, foreign keys, CHECK constraints, views, stored procedures
and triggers — exactly the objects this lab is about. It is also the
production target (Railway MySQL), so the lab runs against the same
engine that serves the app. A SQLite fallback exists only so the project
can be verified locally if MySQL is unavailable; it is not the canonical
database and does not support the advanced objects in
`prisma/advanced-sql/migration.sql`.

## 4. Design / ER Diagram

The full ER diagram (21 entities, attributes, keys and cardinalities) is
in [er-diagram.md](./er-diagram.md) (Mermaid + text) and
[er-diagram.svg](./er-diagram.svg). Key relationships:

- **1:N** — User→Orders, Restaurant→FoodItems, Category→FoodItems,
  Order→OrderItems, Order→Payments, Order→Deliveries.
- **M:N** — User↔Restaurant via `restaurant_admins` (a restaurant can have
  several admins; an admin can manage several restaurants).
- **1:1** — User→Cart (one active cart per customer, `user_id` UNIQUE),
  User→DeliveryPartner, FoodItem→Inventory (one stock row per dish).

The cart belongs to a single restaurant, which enforces the
one-restaurant-per-cart rule at the data layer.

## 5. Relational Schema

Table-by-table columns, types, keys, `ON DELETE`/`ON UPDATE` rules,
indexes and constraints are documented in
[relational-schema.md](./relational-schema.md). Highlights:

- Surrogate `INT AUTO_INCREMENT` primary keys; natural unique keys on
  `users.email`, `categories.slug`, `coupons.code`, `orders.idempotency_key`.
- Referential integrity: `ON DELETE CASCADE` for owned children (addresses,
  cart items, order items), `RESTRICT` where deletion must be blocked
  (a restaurant owner with restaurants, orders referencing users),
  `SET NULL` where history must survive (order items keep their snapshot
  when a menu item is deleted).
- `OrderStatus`, `PaymentMethod`, `PaymentStatus`, `DeliveryStatus`,
  `VegType` and `Role` are enums, so invalid values are rejected by the
  database.

## 6. Normalization

The schema is in **3NF**: atomic columns (1NF), no partial dependencies
on composite keys (2NF), and no transitive dependencies (3NF) — e.g. a
restaurant's city is stored once in `restaurants`, not repeated per dish.
Two intentional denormalizations are documented in
[relational-schema.md](./relational-schema.md): `order_items` stores
price/name **snapshots** so order history stays accurate after menu
changes, and `restaurants.rating` is a cached aggregate of `reviews`.
Both are snapshots/caches, not second sources of truth.

## 7. SQL Operations

- **DDL** — tables, keys and indexes from the Prisma schema; CHECK
  constraints and advanced objects from `advanced-sql`.
- **DML** — CRUD for restaurants, menus, carts, orders, coupons and
  reviews through the app (Prisma) and the seed script.
- **Views** — `v_customer_order_history`, `v_restaurant_sales`,
  `v_popular_foods`, `v_monthly_revenue`.
- **Stored procedures** — `sp_customer_order_history`,
  `sp_restaurant_revenue`.
- **Triggers (demo only)** — `trg_order_status_history`,
  `trg_inventory_audit`; see §9 and [db-objects.md](./db-objects.md).
- **DBMS Lab** — the app exposes a read-only SQL runner guarded by
  `lib/sql-guard.ts`: only single `SELECT`/`WITH` statements over known
  tables are allowed, `LIMIT` is capped at 100, and
  INSERT/UPDATE/DELETE/DROP, multiple statements and `;` injection are
  blocked (unit-tested in `tests/sql-guard.test.js`).

## 8. ACID & Transactions

Checkout is the critical transaction: within one Prisma transaction the
app creates the order and its items (with price snapshots), decrements
inventory, records the payment, creates the delivery row, writes the
first `order_status_history` entry and clears the cart. Either all of
these happen or none do — a failed payment can never leave a half-created
order, and an order can never exist without its payment record
(atomicity). Consistency is enforced by foreign keys, CHECK constraints
and the state machine (`canTransition`, tested in
`tests/transitions.test.js`): e.g. a DELIVERED order cannot move to
CANCELLED. Isolation comes from the database's transaction isolation;
durability from MySQL's redo log once the transaction commits.

## 9. Concurrency Control

- **State machine**: order status transitions are validated before any
  write, so two actors cannot move an order into contradictory states
  (e.g. DELIVERED and CANCELLED).
- **Idempotency keys**: `orders.idempotency_key` is UNIQUE, so a retried
  checkout (double-click, network retry) cannot create a duplicate order.
- **Unique constraints**: one cart per user, one coupon use per order,
  one favourite per (user, dish), one stock row per dish.
- **Inventory**: stock is decremented inside the checkout transaction,
  so two simultaneous checkouts cannot both take the last unit.
- **Single writer for history**: `order_status_history` is written only
  by the application (the trigger is demo-only and never applied with
  the app), so concurrent writers cannot double-log a transition.

## 10. Recovery / Backup

- **Backups**: Railway MySQL provides automated backups; locally,
  `mysqldump food_ordering_db > backup.sql` produces a full logical
  backup, restored with `mysql food_ordering_db < backup.sql`.
- **Point-in-time recovery**: MySQL binary logs allow replay to a chosen
  moment; the redo log guarantees committed transactions survive a crash.
- **Seed as a baseline**: `prisma/seed.ts` is deterministic (seed = 42)
  and idempotent-ish (wipes and re-inserts), so a wiped development
  database can always be rebuilt to a known state with `npm run db:seed`.
- **Migrations**: schema changes are versioned Prisma migrations;
  production applies them with `prisma migrate deploy` (never `migrate dev`).

## 11. Flow of the System

Customer browses restaurants → views menu → adds items to cart (one
restaurant per cart) → checkout: applies a coupon, sees subtotal + 5%
tax + delivery fee − discount → pays (COD, simulated UPI or simulated
card) → order is created atomically with payment and delivery rows →
restaurant confirms and prepares → rider is assigned, picks up and
delivers → customer rates the order. Restaurant admins manage their menu
and inventory (low-stock alerts at `low_stock_at`); the Super Admin
oversees users, restaurants and audit logs. Notifications are generated
at each step.

## 12. Outcome

FoodFlow implements the full ordering lifecycle on a 21-table MySQL
schema with four roles, transactional checkout, simulated payments,
coupons, favourites, reviews, notifications and audit logging. The seed
script produces a reproducible demo dataset (10 categories, 5
restaurants, 50 food items, 25 customers + demo accounts, 10 delivery
partners, 30 orders, 15 reviews, 4 coupons). Advanced SQL objects are
documented and testable, and the unit tests (`npm test`) cover the SQL
guard, order-state transitions and checkout money math.

## 13. Limitations

- Payments are **simulated** (UPI/card) or COD — no real payment gateway.
- No live GPS tracking; delivery status is updated by status changes.
- The Gemini AI assistant is optional and gated by `GEMINI_API_KEY`.
- The DBMS Lab SQL runner is read-only by design.
- The SQLite fallback (local verification only) does not support the
  advanced MySQL objects (procedures, triggers, CHECK constraints).
- Deployment to Railway/Vercel is documented in the README but is not
  claimed as complete.

## 14. Conclusion

FoodFlow shows that a real-world ordering workflow maps cleanly onto a
normalized relational design, and that the database — through keys,
constraints, transactions and a strict state machine — is what makes the
application trustworthy. The deliberate decision to keep
`order_status_history` written by exactly one writer (the application)
illustrates a broader lesson: advanced SQL features are powerful, but
they must be coordinated with application logic, or the same fact gets
recorded twice.
