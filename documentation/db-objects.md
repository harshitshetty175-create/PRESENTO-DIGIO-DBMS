# FoodFlow — Database Objects (Views, Procedures, Triggers, Indexes)

All objects live in `prisma/advanced-sql/migration.sql`
(MySQL 8 only). The Prisma schema creates the tables; this file adds the
advanced objects on top of a MySQL database (Railway). It is **not** applied
in the SQLite fallback.

## 1. CHECK constraints

| Constraint | Table / rule | Why |
|---|---|---|
| `chk_reviews_rating` | `reviews.rating BETWEEN 1 AND 5` | A 0- or 6-star review is invalid data, rejected by the DB, not just the UI. |
| `chk_inventory_stock_nonnegative` | `inventory.stock_qty >= 0` | Stock can never go negative, even if application code has a bug. |
| `chk_orders_total_nonnegative` | `orders.total_amount >= 0` | A negative order total is impossible (discounts are capped). |
| `chk_coupons_discount_range` | `coupons.discount_percent BETWEEN 0 AND 100` | A discount above 100% would pay the customer. |

**How tested:** insert/update violating rows in a scratch MySQL database
and confirm MySQL returns error 3819 (check constraint violated);
`npm test` covers the same rules at the application level only
(`tests/sql-guard.test.js` covers the query guard, not CHECKs).

## 2. Views

| View | Purpose | Key logic |
|---|---|---|
| `v_customer_order_history` | One row per order: customer, restaurant, money, latest delivery status | Joins `orders`/`users`/`restaurants`; correlated subquery picks the newest `deliveries` row. |
| `v_restaurant_sales` | Per-restaurant totals | `COUNT`, `SUM`/`AVG` of non-cancelled totals, cancelled count; `LEFT JOIN` so restaurants with no orders still appear. |
| `v_popular_foods` | Best-selling dishes | Aggregates `order_items` by food item; cancelled orders excluded via the join condition. |
| `v_monthly_revenue` | Revenue by month | `DATE_FORMAT(placed_at, '%Y-%m')` grouping; cancelled orders excluded. |

**How tested:** seed the database (`npm run db:seed`), then
`SELECT * FROM v_restaurant_sales;` and compare `total_orders` / `revenue`
against the same aggregates computed directly from `orders`. Views are
read-only by design — no `INSERT`/`UPDATE` through a view is used anywhere
in the app.

## 3. Stored procedures

| Procedure | Parameters | Returns |
|---|---|---|
| `sp_customer_order_history` | `p_user_id INT` | That customer's orders, newest first (from `v_customer_order_history`). |
| `sp_restaurant_revenue` | `p_restaurant_id INT, p_from DATE, p_to DATE` | Orders, revenue, average order value and discounts for one restaurant in a date range. |

**How tested (MySQL):**

```sql
CALL sp_customer_order_history(1);
CALL sp_restaurant_revenue(1, '2026-11-01', '2026-11-30');
```

Compare the result with the equivalent ad-hoc `SELECT` on the base tables.
Procedures are used for reporting only; no procedure writes data, so they
cannot bypass the application's transaction logic.

## 4. Triggers — DEMO ONLY

| Trigger | On | Does |
|---|---|---|
| `trg_order_status_history` | `AFTER UPDATE ON orders` | Inserts into `order_status_history` when `status` changes. |
| `trg_inventory_audit` | `AFTER UPDATE ON inventory` | Inserts into `audit_logs` when `stock_qty` changes. |

Both triggers are **demonstration objects for the DBMS lab only**. They are
in the same migration file, clearly marked, but must **never be applied
together with the application writer** (see §6).

**How tested (scratch database only):** apply the file to a scratch MySQL
database *without* running the app, update an order's status, and confirm
exactly one `order_status_history` row appears. Then drop the triggers
before pointing the app at that database.

## 5. Indexes (added by the advanced SQL file)

| Index | Columns | Query it serves |
|---|---|---|
| `idx_orders_user_status` | `orders (user_id, status)` | "My orders, filtered by status" — the customer order-history page. |
| `idx_food_items_restaurant_category` | `food_items (restaurant_id, category_id)` | Menu listing filtered by restaurant + category. |

The remaining indexes (e.g. `orders(restaurant_id)`, `food_items(name)`,
`notifications(user_id, is_read)`) are created by Prisma from the schema's
`@@index` definitions. Index choice was driven by the app's actual query
patterns: order history and menu browsing are the two hottest reads.

**How tested:** `EXPLAIN SELECT ... WHERE user_id = ? AND status = 'DELIVERED'`
before/after creating the index — the plan should switch from a full scan
(or a single-column index) to the composite index.

## 6. Single source of truth: `order_status_history`

**Decision: the application writes `order_status_history`; the trigger does not.**

Every status change in the app goes through one code path (the order-status
update in the checkout/admin flow), which:

1. validates the transition (`canTransition`, see `tests/transitions.test.js`),
2. updates `orders.status` and inserts the `order_status_history` row
   **in the same database transaction** — so the order and its history can
   never disagree (atomicity),
3. records `changed_by` (the user who acted), which a trigger cannot know
   (a trigger only sees `OLD`/`NEW` row values, not the logged-in user).

If `trg_order_status_history` were also applied, **every status change
would produce two history rows** — one from the app, one from the trigger —
and the timeline shown to customers would show each step twice. The trigger
therefore exists only so the lab can demonstrate trigger syntax and
behaviour in isolation, on a scratch database. The same reasoning applies
to `trg_inventory_audit` vs the application's audit logging.

**How tested:** the seed script writes history rows through Prisma
(`prisma/seed.ts`, `STATUS_PATH`); after seeding, assert
`SELECT COUNT(*) FROM order_status_history` equals the number of transitions
implied by the seeded orders' final statuses, with no duplicate
`(order_id, old_status, new_status)` pairs.
