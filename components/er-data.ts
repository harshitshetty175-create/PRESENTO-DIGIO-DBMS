/**
 * ER diagram data for food_ordering_db — hand-maintained from
 * prisma/schema.prisma (21 entities). Positions are computed from a
 * 4-column layout; box height derives from the column count.
 */

export type ErColumn = { name: string; type: string; pk?: boolean; fk?: boolean };

export type ErEntity = {
  name: string;
  columns: ErColumn[];
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ErRelation = {
  fromEntity: string;
  fromColumn: string;
  toEntity: string;
  toColumn: string;
};

const BOX_WIDTH = 300;
const COL_GAP_X = 370;
const HEADER_H = 36;
const ROW_H = 20;
const BOX_PAD = 10;

function entity(name: string, columns: ErColumn[]): Omit<ErEntity, "x" | "y" | "width" | "height"> {
  return { name, columns };
}

const LAYOUT: Omit<ErEntity, "x" | "y" | "width" | "height">[][] = [
  [
    entity("users", [
      { name: "id", type: "int", pk: true },
      { name: "name", type: "varchar(120)" },
      { name: "email", type: "varchar(160)" },
      { name: "phone", type: "varchar(20)" },
      { name: "password_hash", type: "varchar(255)" },
      { name: "role", type: "enum" },
      { name: "is_active", type: "tinyint(1)" },
      { name: "created_at", type: "datetime" },
      { name: "updated_at", type: "datetime" },
    ]),
    entity("addresses", [
      { name: "id", type: "int", pk: true },
      { name: "user_id", type: "int", fk: true },
      { name: "label", type: "varchar(60)" },
      { name: "line1", type: "varchar(200)" },
      { name: "city", type: "varchar(80)" },
      { name: "pincode", type: "varchar(10)" },
      { name: "is_default", type: "tinyint(1)" },
    ]),
    entity("restaurants", [
      { name: "id", type: "int", pk: true },
      { name: "owner_id", type: "int", fk: true },
      { name: "name", type: "varchar(150)" },
      { name: "cuisine", type: "varchar(120)" },
      { name: "city", type: "varchar(80)" },
      { name: "rating", type: "decimal(3,2)" },
      { name: "delivery_fee", type: "decimal(10,2)" },
      { name: "is_open", type: "tinyint(1)" },
      { name: "is_active", type: "tinyint(1)" },
    ]),
    entity("restaurant_admins", [
      { name: "id", type: "int", pk: true },
      { name: "restaurant_id", type: "int", fk: true },
      { name: "user_id", type: "int", fk: true },
      { name: "created_at", type: "datetime" },
    ]),
    entity("categories", [
      { name: "id", type: "int", pk: true },
      { name: "name", type: "varchar(80)" },
      { name: "slug", type: "varchar(100)" },
      { name: "image_url", type: "varchar(500)" },
    ]),
  ],
  [
    entity("food_items", [
      { name: "id", type: "int", pk: true },
      { name: "restaurant_id", type: "int", fk: true },
      { name: "category_id", type: "int", fk: true },
      { name: "name", type: "varchar(150)" },
      { name: "price", type: "decimal(10,2)" },
      { name: "veg_type", type: "enum" },
      { name: "is_available", type: "tinyint(1)" },
      { name: "rating", type: "decimal(3,2)" },
    ]),
    entity("inventory", [
      { name: "id", type: "int", pk: true },
      { name: "food_item_id", type: "int", fk: true },
      { name: "stock_qty", type: "int" },
      { name: "low_stock_at", type: "int" },
      { name: "updated_at", type: "datetime" },
    ]),
    entity("carts", [
      { name: "id", type: "int", pk: true },
      { name: "user_id", type: "int", fk: true },
      { name: "restaurant_id", type: "int" },
      { name: "created_at", type: "datetime" },
    ]),
    entity("cart_items", [
      { name: "id", type: "int", pk: true },
      { name: "cart_id", type: "int", fk: true },
      { name: "food_item_id", type: "int", fk: true },
      { name: "qty", type: "int" },
    ]),
    entity("orders", [
      { name: "id", type: "int", pk: true },
      { name: "user_id", type: "int", fk: true },
      { name: "restaurant_id", type: "int", fk: true },
      { name: "address_id", type: "int", fk: true },
      { name: "status", type: "enum" },
      { name: "subtotal", type: "decimal(10,2)" },
      { name: "total_amount", type: "decimal(10,2)" },
      { name: "coupon_code", type: "varchar(40)" },
      { name: "placed_at", type: "datetime" },
    ]),
  ],
  [
    entity("order_items", [
      { name: "id", type: "int", pk: true },
      { name: "order_id", type: "int", fk: true },
      { name: "food_item_id", type: "int", fk: true },
      { name: "item_name", type: "varchar(150)" },
      { name: "unit_price", type: "decimal(10,2)" },
      { name: "qty", type: "int" },
      { name: "line_total", type: "decimal(10,2)" },
    ]),
    entity("payments", [
      { name: "id", type: "int", pk: true },
      { name: "order_id", type: "int", fk: true },
      { name: "amount", type: "decimal(10,2)" },
      { name: "method", type: "enum" },
      { name: "reference", type: "varchar(120)" },
      { name: "status", type: "enum" },
    ]),
    entity("delivery_partners", [
      { name: "id", type: "int", pk: true },
      { name: "user_id", type: "int", fk: true },
      { name: "vehicle_type", type: "varchar(40)" },
      { name: "vehicle_no", type: "varchar(20)" },
      { name: "is_available", type: "tinyint(1)" },
      { name: "rating", type: "decimal(3,2)" },
    ]),
    entity("deliveries", [
      { name: "id", type: "int", pk: true },
      { name: "order_id", type: "int", fk: true },
      { name: "partner_id", type: "int", fk: true },
      { name: "status", type: "enum" },
      { name: "assigned_at", type: "datetime" },
      { name: "accepted_at", type: "datetime" },
      { name: "picked_up_at", type: "datetime" },
      { name: "delivered_at", type: "datetime" },
    ]),
    entity("coupons", [
      { name: "id", type: "int", pk: true },
      { name: "code", type: "varchar(40)" },
      { name: "discount_percent", type: "decimal(5,2)" },
      { name: "max_discount", type: "decimal(10,2)" },
      { name: "min_order", type: "decimal(10,2)" },
      { name: "is_active", type: "tinyint(1)" },
      { name: "valid_to", type: "datetime" },
    ]),
  ],
  [
    entity("coupon_usage", [
      { name: "id", type: "int", pk: true },
      { name: "coupon_id", type: "int", fk: true },
      { name: "user_id", type: "int", fk: true },
      { name: "order_id", type: "int", fk: true },
      { name: "used_at", type: "datetime" },
    ]),
    entity("reviews", [
      { name: "id", type: "int", pk: true },
      { name: "user_id", type: "int", fk: true },
      { name: "restaurant_id", type: "int", fk: true },
      { name: "food_item_id", type: "int", fk: true },
      { name: "order_id", type: "int", fk: true },
      { name: "rating", type: "int" },
      { name: "comment", type: "text" },
    ]),
    entity("favourites", [
      { name: "id", type: "int", pk: true },
      { name: "user_id", type: "int", fk: true },
      { name: "food_item_id", type: "int", fk: true },
      { name: "created_at", type: "datetime" },
    ]),
    entity("notifications", [
      { name: "id", type: "int", pk: true },
      { name: "user_id", type: "int", fk: true },
      { name: "title", type: "varchar(150)" },
      { name: "body", type: "varchar(500)" },
      { name: "type", type: "varchar(60)" },
      { name: "is_read", type: "tinyint(1)" },
    ]),
    entity("order_status_history", [
      { name: "id", type: "int", pk: true },
      { name: "order_id", type: "int", fk: true },
      { name: "old_status", type: "enum" },
      { name: "new_status", type: "enum" },
      { name: "changed_by", type: "int" },
      { name: "created_at", type: "datetime" },
    ]),
    entity("audit_logs", [
      { name: "id", type: "int", pk: true },
      { name: "user_id", type: "int", fk: true },
      { name: "action", type: "varchar(120)" },
      { name: "entity", type: "varchar(80)" },
      { name: "entity_id", type: "int" },
      { name: "details", type: "text" },
    ]),
  ],
];

export const ENTITIES: ErEntity[] = LAYOUT.flatMap((col, ci) => {
  let y = 24;
  return col.map((e) => {
    const height = HEADER_H + e.columns.length * ROW_H + BOX_PAD;
    const placed: ErEntity = {
      ...e,
      x: 24 + ci * COL_GAP_X,
      y,
      width: BOX_WIDTH,
      height,
    };
    y += height + 28;
    return placed;
  });
});

export const DIAGRAM_WIDTH = 24 + 4 * COL_GAP_X;
export const DIAGRAM_HEIGHT = Math.max(
  ...ENTITIES.map((e) => e.y + e.height)
) + 24;

export const RELATIONS: ErRelation[] = [
  { fromEntity: "addresses", fromColumn: "user_id", toEntity: "users", toColumn: "id" },
  { fromEntity: "restaurants", fromColumn: "owner_id", toEntity: "users", toColumn: "id" },
  { fromEntity: "restaurant_admins", fromColumn: "restaurant_id", toEntity: "restaurants", toColumn: "id" },
  { fromEntity: "restaurant_admins", fromColumn: "user_id", toEntity: "users", toColumn: "id" },
  { fromEntity: "food_items", fromColumn: "restaurant_id", toEntity: "restaurants", toColumn: "id" },
  { fromEntity: "food_items", fromColumn: "category_id", toEntity: "categories", toColumn: "id" },
  { fromEntity: "inventory", fromColumn: "food_item_id", toEntity: "food_items", toColumn: "id" },
  { fromEntity: "carts", fromColumn: "user_id", toEntity: "users", toColumn: "id" },
  { fromEntity: "cart_items", fromColumn: "cart_id", toEntity: "carts", toColumn: "id" },
  { fromEntity: "cart_items", fromColumn: "food_item_id", toEntity: "food_items", toColumn: "id" },
  { fromEntity: "orders", fromColumn: "user_id", toEntity: "users", toColumn: "id" },
  { fromEntity: "orders", fromColumn: "restaurant_id", toEntity: "restaurants", toColumn: "id" },
  { fromEntity: "orders", fromColumn: "address_id", toEntity: "addresses", toColumn: "id" },
  { fromEntity: "order_items", fromColumn: "order_id", toEntity: "orders", toColumn: "id" },
  { fromEntity: "order_items", fromColumn: "food_item_id", toEntity: "food_items", toColumn: "id" },
  { fromEntity: "payments", fromColumn: "order_id", toEntity: "orders", toColumn: "id" },
  { fromEntity: "delivery_partners", fromColumn: "user_id", toEntity: "users", toColumn: "id" },
  { fromEntity: "deliveries", fromColumn: "order_id", toEntity: "orders", toColumn: "id" },
  { fromEntity: "deliveries", fromColumn: "partner_id", toEntity: "delivery_partners", toColumn: "id" },
  { fromEntity: "coupon_usage", fromColumn: "coupon_id", toEntity: "coupons", toColumn: "id" },
  { fromEntity: "coupon_usage", fromColumn: "user_id", toEntity: "users", toColumn: "id" },
  { fromEntity: "coupon_usage", fromColumn: "order_id", toEntity: "orders", toColumn: "id" },
  { fromEntity: "reviews", fromColumn: "user_id", toEntity: "users", toColumn: "id" },
  { fromEntity: "reviews", fromColumn: "restaurant_id", toEntity: "restaurants", toColumn: "id" },
  { fromEntity: "reviews", fromColumn: "food_item_id", toEntity: "food_items", toColumn: "id" },
  { fromEntity: "reviews", fromColumn: "order_id", toEntity: "orders", toColumn: "id" },
  { fromEntity: "favourites", fromColumn: "user_id", toEntity: "users", toColumn: "id" },
  { fromEntity: "favourites", fromColumn: "food_item_id", toEntity: "food_items", toColumn: "id" },
  { fromEntity: "notifications", fromColumn: "user_id", toEntity: "users", toColumn: "id" },
  { fromEntity: "order_status_history", fromColumn: "order_id", toEntity: "orders", toColumn: "id" },
  { fromEntity: "audit_logs", fromColumn: "user_id", toEntity: "users", toColumn: "id" },
];

export { HEADER_H, ROW_H };
