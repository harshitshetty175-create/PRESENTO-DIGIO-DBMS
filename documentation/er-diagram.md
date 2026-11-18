# FoodFlow — ER Diagram

All 21 entities from `prisma/schema.prisma` (canonical MySQL schema).
A hand-drawn SVG version of the same diagram is in
[`er-diagram.svg`](./er-diagram.svg).

## Mermaid ER diagram

```mermaid
erDiagram
    User ||--o{ Address : "has"
    User ||--o{ Restaurant : "owns"
    User ||--o{ RestaurantAdmin : "administers"
    Restaurant ||--o{ RestaurantAdmin : "managed by"
    User ||--o{ Cart : "has (1:1)"
    Cart ||--o{ CartItem : "contains"
    FoodItem ||--o{ CartItem : "in"
    User ||--o{ Order : "places"
    Restaurant ||--o{ Order : "receives"
    Address ||--o{ Order : "deliver to"
    Order ||--o{ OrderItem : "contains"
    FoodItem ||--o{ OrderItem : "ordered as"
    Order ||--o{ Payment : "paid by"
    Order ||--o{ Delivery : "fulfilled by"
    DeliveryPartner ||--o{ Delivery : "delivers"
    User ||--o{ DeliveryPartner : "is (1:1)"
    Restaurant ||--o{ FoodItem : "serves"
    Category ||--o{ FoodItem : "classifies"
    FoodItem ||--o{ Inventory : "stocked as (1:1)"
    User ||--o{ Review : "writes"
    Restaurant ||--o{ Review : "receives"
    FoodItem ||--o{ Review : "reviewed"
    Order ||--o{ Review : "about"
    User ||--o{ Favourite : "saves"
    FoodItem ||--o{ Favourite : "saved by"
    User ||--o{ Notification : "receives"
    Order ||--o{ OrderStatusHistory : "tracked by"
    User ||--o{ AuditLog : "performs"
    Coupon ||--o{ CouponUsage : "redeemed as"
    User ||--o{ CouponUsage : "redeems"
    Order ||--o{ CouponUsage : "uses (1:1)"

    User {
        int id PK
        string name
        string email UK
        string phone
        string password_hash
        Role role
        boolean is_active
        datetime created_at
        datetime updated_at
    }
    Address {
        int id PK
        int user_id FK
        string label
        string line1
        string line2
        string city
        string pincode
        boolean is_default
    }
    Restaurant {
        int id PK
        int owner_id FK
        string name
        string cuisine
        string address
        string city
        decimal rating
        decimal delivery_fee
        decimal min_order
        int delivery_mins
        boolean is_open
        boolean is_active
    }
    RestaurantAdmin {
        int id PK
        int restaurant_id FK
        int user_id FK
    }
    Category {
        int id PK
        string name UK
        string slug UK
        string image_url
    }
    FoodItem {
        int id PK
        int restaurant_id FK
        int category_id FK
        string name
        decimal price
        VegType veg_type
        boolean is_available
        boolean is_veg
        decimal rating
    }
    Inventory {
        int id PK
        int food_item_id FK_UK
        int stock_qty
        int low_stock_at
    }
    Cart {
        int id PK
        int user_id FK_UK
        int restaurant_id
    }
    CartItem {
        int id PK
        int cart_id FK
        int food_item_id FK
        int qty
    }
    Order {
        int id PK
        int user_id FK
        int restaurant_id FK
        int address_id FK
        OrderStatus status
        decimal subtotal
        decimal delivery_fee
        decimal tax_amount
        decimal discount_amount
        decimal total_amount
        string coupon_code
        string idempotency_key UK
        datetime placed_at
    }
    OrderItem {
        int id PK
        int order_id FK
        int food_item_id FK
        string item_name
        decimal unit_price
        int qty
        decimal line_total
    }
    Payment {
        int id PK
        int order_id FK
        decimal amount
        PaymentMethod method
        string reference
        PaymentStatus status
    }
    DeliveryPartner {
        int id PK
        int user_id FK_UK
        string vehicle_type
        string vehicle_no
        boolean is_available
        decimal rating
    }
    Delivery {
        int id PK
        int order_id FK
        int partner_id FK
        DeliveryStatus status
        datetime assigned_at
        datetime accepted_at
        datetime picked_up_at
        datetime delivered_at
    }
    Coupon {
        int id PK
        string code UK
        decimal discount_percent
        decimal max_discount
        decimal min_order
        boolean is_active
        datetime valid_from
        datetime valid_to
    }
    CouponUsage {
        int id PK
        int coupon_id FK
        int user_id FK
        int order_id UK
    }
    Review {
        int id PK
        int user_id FK
        int restaurant_id FK
        int food_item_id FK
        int order_id FK
        int rating
        string comment
    }
    Favourite {
        int id PK
        int user_id FK
        int food_item_id FK
    }
    Notification {
        int id PK
        int user_id FK
        string title
        string body
        string type
        boolean is_read
    }
    OrderStatusHistory {
        int id PK
        int order_id FK
        OrderStatus old_status
        OrderStatus new_status
        int changed_by
    }
    AuditLog {
        int id PK
        int user_id FK
        string action
        string entity
        int entity_id
        string details
    }
```

## Entities (21)

| # | Entity | Table | Purpose |
|---|--------|-------|---------|
| 1 | User | `users` | All accounts; role decides capabilities (CUSTOMER / RESTAURANT_ADMIN / DELIVERY_PARTNER / SUPER_ADMIN) |
| 2 | Address | `addresses` | Delivery addresses belonging to a user |
| 3 | Restaurant | `restaurants` | Restaurant profile, fees, opening state |
| 4 | RestaurantAdmin | `restaurant_admins` | M:N link: admins ↔ restaurants |
| 5 | Category | `categories` | Food categories (North Indian, Chinese, …) |
| 6 | FoodItem | `food_items` | Menu items with price and veg type |
| 7 | Inventory | `inventory` | Stock per food item |
| 8 | Cart | `carts` | One active cart per customer |
| 9 | CartItem | `cart_items` | Lines in a cart |
| 10 | Order | `orders` | Customer order with money breakdown |
| 11 | OrderItem | `order_items` | Order lines with price/name snapshots |
| 12 | Payment | `payments` | Payment attempts (simulated UPI/card, COD) |
| 13 | DeliveryPartner | `delivery_partners` | Rider profile + vehicle |
| 14 | Delivery | `deliveries` | Fulfilment of one order by one partner |
| 15 | Coupon | `coupons` | Discount codes |
| 16 | CouponUsage | `coupon_usage` | One redemption per order |
| 17 | Review | `reviews` | Ratings (1–5) and comments |
| 18 | Favourite | `favourites` | Saved dishes |
| 19 | Notification | `notifications` | In-app messages to a user |
| 20 | OrderStatusHistory | `order_status_history` | Audit trail of order status changes |
| 21 | AuditLog | `audit_logs` | Admin/system action log |

## Cardinalities

| Relationship | Type | Notes |
|---|---|---|
| User – Address | 1:N | A user has many addresses; an address belongs to one user. |
| User – Restaurant | 1:N | A user owns many restaurants; a restaurant has one owner (`owner_id`, `ON DELETE RESTRICT`). |
| User – RestaurantAdmin – Restaurant | M:N | Via `restaurant_admins`; a restaurant may have several admins, an admin may manage several restaurants. Unique `(restaurant_id, user_id)`. |
| User – Cart | 1:1 | `carts.user_id` is UNIQUE — one active cart per customer. A cart also references one restaurant, enforcing the one-restaurant-per-cart rule. |
| Cart – CartItem | 1:N | Unique `(cart_id, food_item_id)` — no duplicate lines. |
| Category – FoodItem | 1:N | A category classifies many items. |
| Restaurant – FoodItem | 1:N | A restaurant serves many items. |
| FoodItem – Inventory | 1:1 | `inventory.food_item_id` is UNIQUE — exactly one stock row per item. |
| User – Order | 1:N | A customer places many orders. |
| Restaurant – Order | 1:N | A restaurant receives many orders. |
| Address – Order | 1:N | An address is the delivery destination of many orders (nullable FK). |
| Order – OrderItem | 1:N | An order has 1–4+ lines (seed data: 1–4). |
| FoodItem – OrderItem | 1:N | An item appears in many orders; `food_item_id` is nullable with `ON DELETE SET NULL` so history survives menu deletions. |
| Order – Payment | 1:N | An order may have several payment attempts; the latest successful one counts. |
| User – DeliveryPartner | 1:1 | `delivery_partners.user_id` is UNIQUE — a user is at most one rider. |
| DeliveryPartner – Delivery | 1:N | A partner fulfils many deliveries. |
| Order – Delivery | 1:N | An order may have several delivery attempts (re-assignment); normally one. |
| Coupon – CouponUsage | 1:N | A coupon is redeemed many times. |
| User – CouponUsage | 1:N | A user redeems many coupons. |
| Order – CouponUsage | 1:1 | `coupon_usage.order_id` is UNIQUE — at most one coupon per order. |
| User – Review | 1:N | A user writes many reviews. |
| Restaurant – Review | 1:N | A restaurant receives many reviews. |
| FoodItem – Review | 1:N | Optional: a review may target one dish. |
| Order – Review | 1:N | Optional: a review may reference the order it is about. |
| User – Favourite | 1:N | Unique `(user_id, food_item_id)`. |
| FoodItem – Favourite | 1:N | A dish is favourited by many users. |
| User – Notification | 1:N | A user receives many notifications. |
| Order – OrderStatusHistory | 1:N | Every status transition is one history row (written by the application). |
| User – AuditLog | 1:N | Optional (`user_id` nullable): system actions have no user. |

## Enums

- **Role**: CUSTOMER, RESTAURANT_ADMIN, DELIVERY_PARTNER, SUPER_ADMIN
- **OrderStatus**: PLACED, CONFIRMED, PREPARING, READY_FOR_PICKUP, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, REJECTED
- **PaymentMethod**: COD, UPI_SIMULATED, CARD_SIMULATED
- **PaymentStatus**: PENDING, SUCCESS, FAILED, REFUNDED
- **DeliveryStatus**: ASSIGNED, ACCEPTED, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
- **VegType**: VEG, NON_VEG, VEGAN
