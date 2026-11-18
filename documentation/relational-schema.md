# FoodFlow — Relational Schema

Source of truth: `prisma/schema.prisma` (MySQL 8, database `food_ordering_db`).
Types below are the MySQL column types Prisma generates. All tables use
`INT AUTO_INCREMENT` surrogate primary keys unless noted. `created_at` /
`updated_at` audit columns are present on most tables and omitted from the
per-table lists where they add no design information (they are listed in the
schema file).

Conventions: `ON DELETE CASCADE` = child rows die with the parent;
`RESTRICT` = parent cannot be deleted while children exist;
`SET NULL` = the reference is cleared, the row survives.

## 1. users

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK, AUTO_INCREMENT |
| name | VARCHAR(120) | NOT NULL |
| email | VARCHAR(160) | NOT NULL, UNIQUE |
| phone | VARCHAR(20) | NULL |
| password_hash | VARCHAR(255) | NOT NULL (bcrypt) |
| role | ENUM(Role) | NOT NULL, DEFAULT CUSTOMER |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at / updated_at | DATETIME | |

Indexes: `role`, `email`.

## 2. addresses

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| user_id | INT | NOT NULL, FK → users.id ON DELETE CASCADE |
| label | VARCHAR(60) | NOT NULL (Home / Work / Other) |
| line1 | VARCHAR(200) | NOT NULL |
| line2 | VARCHAR(200) | NULL |
| city | VARCHAR(80) | NOT NULL |
| pincode | VARCHAR(10) | NOT NULL |
| is_default | BOOLEAN | DEFAULT FALSE |

Index: `user_id`.

## 3. restaurants

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| owner_id | INT | NOT NULL, FK → users.id ON DELETE RESTRICT |
| name | VARCHAR(150) | NOT NULL |
| description | TEXT | NULL |
| cuisine | VARCHAR(120) | NOT NULL |
| address | VARCHAR(250) | NOT NULL |
| city | VARCHAR(80) | NOT NULL |
| phone | VARCHAR(20) | NULL |
| image_url | VARCHAR(500) | NULL |
| rating | DECIMAL(3,2) | DEFAULT 0.00 |
| delivery_fee | DECIMAL(10,2) | DEFAULT 29.00 |
| min_order | DECIMAL(10,2) | DEFAULT 0.00 |
| delivery_mins | INT | DEFAULT 35 |
| is_open / is_active | BOOLEAN | DEFAULT TRUE |

Indexes: `owner_id`, `cuisine`, `city`, `(is_active, is_open)`.

## 4. restaurant_admins (M:N link)

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| restaurant_id | INT | NOT NULL, FK → restaurants.id ON DELETE CASCADE |
| user_id | INT | NOT NULL, FK → users.id ON DELETE CASCADE |
| created_at | DATETIME | |

Unique: `(restaurant_id, user_id)`. Index: `user_id`.

## 5. categories

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| name | VARCHAR(80) | NOT NULL, UNIQUE |
| slug | VARCHAR(100) | NOT NULL, UNIQUE |
| image_url | VARCHAR(500) | NULL |
| created_at | DATETIME | |

## 6. food_items

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| restaurant_id | INT | NOT NULL, FK → restaurants.id ON DELETE CASCADE |
| category_id | INT | NOT NULL, FK → categories.id ON DELETE RESTRICT |
| name | VARCHAR(150) | NOT NULL |
| description | TEXT | NULL |
| price | DECIMAL(10,2) | NOT NULL |
| image_url | VARCHAR(500) | NULL |
| veg_type | ENUM(VegType) | DEFAULT VEG |
| is_available | BOOLEAN | DEFAULT TRUE |
| is_veg | BOOLEAN | DEFAULT TRUE |
| rating | DECIMAL(3,2) | DEFAULT 0.00 |

Indexes: `restaurant_id`, `category_id`, `is_available`, `name`,
`idx_food_items_restaurant_category (restaurant_id, category_id)` (advanced SQL file).

## 7. inventory

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| food_item_id | INT | NOT NULL, UNIQUE, FK → food_items.id ON DELETE CASCADE |
| stock_qty | INT | DEFAULT 0, CHECK stock_qty >= 0 (advanced SQL file) |
| low_stock_at | INT | DEFAULT 5 |
| updated_at | DATETIME | |

One stock row per food item (1:1 via the UNIQUE FK).

## 8. carts

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| user_id | INT | NOT NULL, UNIQUE, FK → users.id ON DELETE CASCADE |
| restaurant_id | INT | NULL (the single restaurant the cart belongs to) |

One active cart per customer (1:1 via the UNIQUE FK).

## 9. cart_items

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| cart_id | INT | NOT NULL, FK → carts.id ON DELETE CASCADE |
| food_item_id | INT | NOT NULL, FK → food_items.id ON DELETE CASCADE |
| qty | INT | DEFAULT 1 |
| created_at | DATETIME | |

Unique: `(cart_id, food_item_id)`. Index: `food_item_id`.

## 10. orders

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| user_id | INT | NOT NULL, FK → users.id ON DELETE RESTRICT |
| restaurant_id | INT | NOT NULL, FK → restaurants.id ON DELETE RESTRICT |
| address_id | INT | NULL, FK → addresses.id ON DELETE SET NULL |
| status | ENUM(OrderStatus) | DEFAULT PLACED |
| subtotal | DECIMAL(10,2) | NOT NULL |
| delivery_fee | DECIMAL(10,2) | DEFAULT 0.00 |
| tax_amount | DECIMAL(10,2) | DEFAULT 0.00 |
| discount_amount | DECIMAL(10,2) | DEFAULT 0.00 |
| total_amount | DECIMAL(10,2) | NOT NULL, CHECK total_amount >= 0 (advanced SQL file) |
| coupon_code | VARCHAR(40) | NULL (denormalised copy of the redeemed code) |
| instructions | VARCHAR(300) | NULL |
| idempotency_key | VARCHAR(100) | NULL, UNIQUE (safe checkout retries) |
| placed_at | DATETIME | DEFAULT NOW() |

Indexes: `user_id`, `restaurant_id`, `status`, `placed_at`,
`idx_orders_user_status (user_id, status)` (advanced SQL file).

## 11. order_items

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| order_id | INT | NOT NULL, FK → orders.id ON DELETE CASCADE |
| food_item_id | INT | NULL, FK → food_items.id ON DELETE SET NULL |
| item_name | VARCHAR(150) | NOT NULL — price/name snapshot |
| unit_price | DECIMAL(10,2) | NOT NULL — snapshot |
| qty | INT | NOT NULL |
| line_total | DECIMAL(10,2) | NOT NULL (= unit_price × qty) |

Index: `order_id`.

## 12. payments

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| order_id | INT | NOT NULL, FK → orders.id ON DELETE CASCADE |
| amount | DECIMAL(10,2) | NOT NULL |
| method | ENUM(PaymentMethod) | COD / UPI_SIMULATED / CARD_SIMULATED |
| reference | VARCHAR(120) | NULL (`SIM-…` for simulated payments) |
| status | ENUM(PaymentStatus) | DEFAULT PENDING |

Indexes: `order_id`, `status`.

## 13. delivery_partners

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| user_id | INT | NOT NULL, UNIQUE, FK → users.id ON DELETE CASCADE |
| vehicle_type | VARCHAR(40) | NOT NULL (Bike / Scooter / Bicycle) |
| vehicle_no | VARCHAR(20) | NULL |
| is_available / is_active | BOOLEAN | DEFAULT TRUE |
| rating | DECIMAL(3,2) | DEFAULT 0.00 |

Index: `is_available`.

## 14. deliveries

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| order_id | INT | NOT NULL, FK → orders.id ON DELETE CASCADE |
| partner_id | INT | NULL, FK → delivery_partners.id ON DELETE SET NULL |
| status | ENUM(DeliveryStatus) | DEFAULT ASSIGNED |
| assigned_at | DATETIME | DEFAULT NOW() |
| accepted_at / picked_up_at / delivered_at | DATETIME | NULL |

Indexes: `order_id`, `partner_id`, `status`.

## 15. coupons

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| code | VARCHAR(40) | NOT NULL, UNIQUE |
| description | VARCHAR(200) | NULL |
| discount_percent | DECIMAL(5,2) | NOT NULL, CHECK 0–100 (advanced SQL file) |
| max_discount | DECIMAL(10,2) | DEFAULT 0.00 |
| min_order | DECIMAL(10,2) | DEFAULT 0.00 |
| is_active | BOOLEAN | DEFAULT TRUE |
| valid_from | DATETIME | DEFAULT NOW() |
| valid_to | DATETIME | NULL |

Index: `is_active`.

## 16. coupon_usage

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| coupon_id | INT | NOT NULL, FK → coupons.id ON DELETE CASCADE |
| user_id | INT | NOT NULL, FK → users.id ON DELETE CASCADE |
| order_id | INT | NOT NULL, UNIQUE (one coupon per order) |
| used_at | DATETIME | DEFAULT NOW() |

Index: `coupon_id`.

## 17. reviews

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| user_id | INT | NOT NULL, FK → users.id ON DELETE CASCADE |
| restaurant_id | INT | NOT NULL, FK → restaurants.id ON DELETE CASCADE |
| food_item_id | INT | NULL, FK → food_items.id ON DELETE SET NULL |
| order_id | INT | NULL, FK → orders.id ON DELETE SET NULL |
| rating | INT | NOT NULL, CHECK 1–5 (advanced SQL file) |
| comment | TEXT | NULL |
| created_at | DATETIME | |

Indexes: `restaurant_id`, `food_item_id`.

## 18. favourites

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| user_id | INT | NOT NULL, FK → users.id ON DELETE CASCADE |
| food_item_id | INT | NOT NULL, FK → food_items.id ON DELETE CASCADE |
| created_at | DATETIME | |

Unique: `(user_id, food_item_id)`.

## 19. notifications

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| user_id | INT | NOT NULL, FK → users.id ON DELETE CASCADE |
| title | VARCHAR(150) | NOT NULL |
| body | VARCHAR(500) | NOT NULL |
| type | VARCHAR(60) | NOT NULL (ORDER / PAYMENT / DELIVERY / SYSTEM) |
| is_read | BOOLEAN | DEFAULT FALSE |
| created_at | DATETIME | |

Index: `(user_id, is_read)`.

## 20. order_status_history

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| order_id | INT | NOT NULL, FK → orders.id ON DELETE CASCADE |
| old_status | ENUM(OrderStatus) | NULL (NULL for the first PLACED row) |
| new_status | ENUM(OrderStatus) | NOT NULL |
| changed_by | INT | NULL (user id that triggered the change) |
| created_at | DATETIME | DEFAULT NOW() |

Index: `order_id`. Written by the **application**, not by a trigger
(see `db-objects.md`).

## 21. audit_logs

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK |
| user_id | INT | NULL, FK → users.id ON DELETE SET NULL |
| action | VARCHAR(120) | NOT NULL |
| entity | VARCHAR(80) | NOT NULL |
| entity_id | INT | NULL |
| details | TEXT | NULL |
| created_at | DATETIME | DEFAULT NOW() |

Indexes: `entity`, `created_at`.

## Normalization

The schema is in **3NF**:

- **1NF** — every column holds atomic values; no repeating groups (order
  lines are separate `order_items` rows, not columns on `orders`).
- **2NF** — every non-key attribute depends on the whole primary key.
  Composite keys (`restaurant_admins`, `favourites`, `cart_items`,
  `coupon_usage`) have no partial dependencies: all non-key columns depend
  on the full key (or are the key itself).
- **3NF** — no transitive dependencies: e.g. a restaurant's city is stored
  once in `restaurants`, not repeated per food item; a user's email lives
  only in `users`.

**Intentional denormalization (snapshots, not redundancy):**

- `order_items.item_name` / `unit_price` copy the food item's name and
  price at order time, so an order's history stays correct after a menu
  price changes. The live price still lives only in `food_items.price`.
- `orders.coupon_code` copies the redeemed coupon's code for quick display;
  the authoritative redemption record is `coupon_usage` (FK to `coupons`).
- `restaurants.rating` / `food_items.rating` are cached aggregates,
  recomputed from `reviews`; they are a performance cache, not a second
  source of truth.
