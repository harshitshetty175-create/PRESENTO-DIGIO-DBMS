import { prisma } from "@/lib/prisma";

export type TableColumn = {
  name: string;
  type: string;
  nullable: boolean;
  key: string; // "PRI" | "UNI" | "MUL" | ""
};

export type TableMeta = {
  columns: TableColumn[];
  primaryKey: string | null;
  foreignKeys: { column: string; references: string }[];
};

function col(
  name: string,
  type: string,
  nullable = false,
  key = ""
): TableColumn {
  return { name, type, nullable, key };
}

/**
 * Hand-maintained column map derived from prisma/schema.prisma.
 * Used as the fallback for /api/lab/overview and as the column source for
 * /api/lab/tables/[name]. The 21 tables of food_ordering_db.
 */
export const TABLE_META: Record<string, TableMeta> = {
  users: {
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      col("id", "int", false, "PRI"),
      col("name", "varchar(120)"),
      col("email", "varchar(160)", false, "UNI"),
      col("phone", "varchar(20)", true),
      col("password_hash", "varchar(255)"),
      col("role", "enum(CUSTOMER,RESTAURANT_ADMIN,DELIVERY_PARTNER,SUPER_ADMIN)"),
      col("is_active", "tinyint(1)"),
      col("created_at", "datetime"),
      col("updated_at", "datetime"),
    ],
  },
  addresses: {
    primaryKey: "id",
    foreignKeys: [{ column: "user_id", references: "users.id" }],
    columns: [
      col("id", "int", false, "PRI"),
      col("user_id", "int", false, "MUL"),
      col("label", "varchar(60)"),
      col("line1", "varchar(200)"),
      col("line2", "varchar(200)", true),
      col("city", "varchar(80)"),
      col("pincode", "varchar(10)"),
      col("is_default", "tinyint(1)"),
      col("created_at", "datetime"),
      col("updated_at", "datetime"),
    ],
  },
  restaurants: {
    primaryKey: "id",
    foreignKeys: [{ column: "owner_id", references: "users.id" }],
    columns: [
      col("id", "int", false, "PRI"),
      col("owner_id", "int", false, "MUL"),
      col("name", "varchar(150)"),
      col("description", "text", true),
      col("cuisine", "varchar(120)"),
      col("address", "varchar(250)"),
      col("city", "varchar(80)"),
      col("phone", "varchar(20)", true),
      col("image_url", "varchar(500)", true),
      col("rating", "decimal(3,2)"),
      col("delivery_fee", "decimal(10,2)"),
      col("min_order", "decimal(10,2)"),
      col("delivery_mins", "int"),
      col("is_open", "tinyint(1)"),
      col("is_active", "tinyint(1)"),
      col("created_at", "datetime"),
      col("updated_at", "datetime"),
    ],
  },
  restaurant_admins: {
    primaryKey: "id",
    foreignKeys: [
      { column: "restaurant_id", references: "restaurants.id" },
      { column: "user_id", references: "users.id" },
    ],
    columns: [
      col("id", "int", false, "PRI"),
      col("restaurant_id", "int", false, "MUL"),
      col("user_id", "int", false, "MUL"),
      col("created_at", "datetime"),
    ],
  },
  categories: {
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      col("id", "int", false, "PRI"),
      col("name", "varchar(80)", false, "UNI"),
      col("slug", "varchar(100)", false, "UNI"),
      col("image_url", "varchar(500)", true),
      col("created_at", "datetime"),
    ],
  },
  food_items: {
    primaryKey: "id",
    foreignKeys: [
      { column: "restaurant_id", references: "restaurants.id" },
      { column: "category_id", references: "categories.id" },
    ],
    columns: [
      col("id", "int", false, "PRI"),
      col("restaurant_id", "int", false, "MUL"),
      col("category_id", "int", false, "MUL"),
      col("name", "varchar(150)"),
      col("description", "text", true),
      col("price", "decimal(10,2)"),
      col("image_url", "varchar(500)", true),
      col("veg_type", "enum(VEG,NON_VEG,VEGAN)"),
      col("is_available", "tinyint(1)"),
      col("is_veg", "tinyint(1)"),
      col("rating", "decimal(3,2)"),
      col("created_at", "datetime"),
      col("updated_at", "datetime"),
    ],
  },
  inventory: {
    primaryKey: "id",
    foreignKeys: [{ column: "food_item_id", references: "food_items.id" }],
    columns: [
      col("id", "int", false, "PRI"),
      col("food_item_id", "int", false, "UNI"),
      col("stock_qty", "int"),
      col("low_stock_at", "int"),
      col("updated_at", "datetime"),
    ],
  },
  carts: {
    primaryKey: "id",
    foreignKeys: [{ column: "user_id", references: "users.id" }],
    columns: [
      col("id", "int", false, "PRI"),
      col("user_id", "int", false, "UNI"),
      col("restaurant_id", "int", true),
      col("created_at", "datetime"),
      col("updated_at", "datetime"),
    ],
  },
  cart_items: {
    primaryKey: "id",
    foreignKeys: [
      { column: "cart_id", references: "carts.id" },
      { column: "food_item_id", references: "food_items.id" },
    ],
    columns: [
      col("id", "int", false, "PRI"),
      col("cart_id", "int", false, "MUL"),
      col("food_item_id", "int", false, "MUL"),
      col("qty", "int"),
      col("created_at", "datetime"),
    ],
  },
  orders: {
    primaryKey: "id",
    foreignKeys: [
      { column: "user_id", references: "users.id" },
      { column: "restaurant_id", references: "restaurants.id" },
      { column: "address_id", references: "addresses.id" },
    ],
    columns: [
      col("id", "int", false, "PRI"),
      col("user_id", "int", false, "MUL"),
      col("restaurant_id", "int", false, "MUL"),
      col("address_id", "int", true),
      col("status", "enum(PLACED,CONFIRMED,PREPARING,READY_FOR_PICKUP,PICKED_UP,OUT_FOR_DELIVERY,DELIVERED,CANCELLED,REJECTED)"),
      col("subtotal", "decimal(10,2)"),
      col("delivery_fee", "decimal(10,2)"),
      col("tax_amount", "decimal(10,2)"),
      col("discount_amount", "decimal(10,2)"),
      col("total_amount", "decimal(10,2)"),
      col("coupon_code", "varchar(40)", true),
      col("instructions", "varchar(300)", true),
      col("idempotency_key", "varchar(100)", true, "UNI"),
      col("placed_at", "datetime"),
      col("created_at", "datetime"),
      col("updated_at", "datetime"),
    ],
  },
  order_items: {
    primaryKey: "id",
    foreignKeys: [
      { column: "order_id", references: "orders.id" },
      { column: "food_item_id", references: "food_items.id" },
    ],
    columns: [
      col("id", "int", false, "PRI"),
      col("order_id", "int", false, "MUL"),
      col("food_item_id", "int", true),
      col("item_name", "varchar(150)"),
      col("unit_price", "decimal(10,2)"),
      col("qty", "int"),
      col("line_total", "decimal(10,2)"),
    ],
  },
  payments: {
    primaryKey: "id",
    foreignKeys: [{ column: "order_id", references: "orders.id" }],
    columns: [
      col("id", "int", false, "PRI"),
      col("order_id", "int", false, "MUL"),
      col("amount", "decimal(10,2)"),
      col("method", "enum(COD,UPI_SIMULATED,CARD_SIMULATED)"),
      col("reference", "varchar(120)", true),
      col("status", "enum(PENDING,SUCCESS,FAILED,REFUNDED)"),
      col("created_at", "datetime"),
      col("updated_at", "datetime"),
    ],
  },
  delivery_partners: {
    primaryKey: "id",
    foreignKeys: [{ column: "user_id", references: "users.id" }],
    columns: [
      col("id", "int", false, "PRI"),
      col("user_id", "int", false, "UNI"),
      col("vehicle_type", "varchar(40)"),
      col("vehicle_no", "varchar(20)", true),
      col("is_available", "tinyint(1)"),
      col("is_active", "tinyint(1)"),
      col("rating", "decimal(3,2)"),
      col("created_at", "datetime"),
      col("updated_at", "datetime"),
    ],
  },
  deliveries: {
    primaryKey: "id",
    foreignKeys: [
      { column: "order_id", references: "orders.id" },
      { column: "partner_id", references: "delivery_partners.id" },
    ],
    columns: [
      col("id", "int", false, "PRI"),
      col("order_id", "int", false, "MUL"),
      col("partner_id", "int", true, "MUL"),
      col("status", "enum(ASSIGNED,ACCEPTED,PICKED_UP,OUT_FOR_DELIVERY,DELIVERED,CANCELLED)"),
      col("assigned_at", "datetime"),
      col("accepted_at", "datetime", true),
      col("picked_up_at", "datetime", true),
      col("delivered_at", "datetime", true),
    ],
  },
  coupons: {
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      col("id", "int", false, "PRI"),
      col("code", "varchar(40)", false, "UNI"),
      col("description", "varchar(200)", true),
      col("discount_percent", "decimal(5,2)"),
      col("max_discount", "decimal(10,2)"),
      col("min_order", "decimal(10,2)"),
      col("is_active", "tinyint(1)"),
      col("valid_from", "datetime"),
      col("valid_to", "datetime", true),
      col("created_at", "datetime"),
    ],
  },
  coupon_usage: {
    primaryKey: "id",
    foreignKeys: [
      { column: "coupon_id", references: "coupons.id" },
      { column: "user_id", references: "users.id" },
      { column: "order_id", references: "orders.id" },
    ],
    columns: [
      col("id", "int", false, "PRI"),
      col("coupon_id", "int", false, "MUL"),
      col("user_id", "int", false, "MUL"),
      col("order_id", "int", false, "UNI"),
      col("used_at", "datetime"),
    ],
  },
  reviews: {
    primaryKey: "id",
    foreignKeys: [
      { column: "user_id", references: "users.id" },
      { column: "restaurant_id", references: "restaurants.id" },
      { column: "food_item_id", references: "food_items.id" },
      { column: "order_id", references: "orders.id" },
    ],
    columns: [
      col("id", "int", false, "PRI"),
      col("user_id", "int", false, "MUL"),
      col("restaurant_id", "int", false, "MUL"),
      col("food_item_id", "int", true, "MUL"),
      col("order_id", "int", true),
      col("rating", "int"),
      col("comment", "text", true),
      col("created_at", "datetime"),
    ],
  },
  favourites: {
    primaryKey: "id",
    foreignKeys: [
      { column: "user_id", references: "users.id" },
      { column: "food_item_id", references: "food_items.id" },
    ],
    columns: [
      col("id", "int", false, "PRI"),
      col("user_id", "int", false, "MUL"),
      col("food_item_id", "int", false, "MUL"),
      col("created_at", "datetime"),
    ],
  },
  notifications: {
    primaryKey: "id",
    foreignKeys: [{ column: "user_id", references: "users.id" }],
    columns: [
      col("id", "int", false, "PRI"),
      col("user_id", "int", false, "MUL"),
      col("title", "varchar(150)"),
      col("body", "varchar(500)"),
      col("type", "varchar(60)"),
      col("is_read", "tinyint(1)"),
      col("created_at", "datetime"),
    ],
  },
  order_status_history: {
    primaryKey: "id",
    foreignKeys: [{ column: "order_id", references: "orders.id" }],
    columns: [
      col("id", "int", false, "PRI"),
      col("order_id", "int", false, "MUL"),
      col("old_status", "enum(PLACED,CONFIRMED,PREPARING,READY_FOR_PICKUP,PICKED_UP,OUT_FOR_DELIVERY,DELIVERED,CANCELLED,REJECTED)", true),
      col("new_status", "enum(PLACED,CONFIRMED,PREPARING,READY_FOR_PICKUP,PICKED_UP,OUT_FOR_DELIVERY,DELIVERED,CANCELLED,REJECTED)"),
      col("changed_by", "int", true),
      col("created_at", "datetime"),
    ],
  },
  audit_logs: {
    primaryKey: "id",
    foreignKeys: [{ column: "user_id", references: "users.id" }],
    columns: [
      col("id", "int", false, "PRI"),
      col("user_id", "int", true),
      col("action", "varchar(120)"),
      col("entity", "varchar(80)"),
      col("entity_id", "int", true),
      col("details", "text", true),
      col("created_at", "datetime"),
    ],
  },
};

export const TABLE_NAMES: string[] = Object.keys(TABLE_META);

/** Real row count for one allowlisted table, via its Prisma model. */
export async function countTable(name: string): Promise<number> {
  switch (name) {
    case "users":
      return prisma.user.count();
    case "addresses":
      return prisma.address.count();
    case "restaurants":
      return prisma.restaurant.count();
    case "restaurant_admins":
      return prisma.restaurantAdmin.count();
    case "categories":
      return prisma.category.count();
    case "food_items":
      return prisma.foodItem.count();
    case "inventory":
      return prisma.inventory.count();
    case "carts":
      return prisma.cart.count();
    case "cart_items":
      return prisma.cartItem.count();
    case "orders":
      return prisma.order.count();
    case "order_items":
      return prisma.orderItem.count();
    case "payments":
      return prisma.payment.count();
    case "delivery_partners":
      return prisma.deliveryPartner.count();
    case "deliveries":
      return prisma.delivery.count();
    case "coupons":
      return prisma.coupon.count();
    case "coupon_usage":
      return prisma.couponUsage.count();
    case "reviews":
      return prisma.review.count();
    case "favourites":
      return prisma.favourite.count();
    case "notifications":
      return prisma.notification.count();
    case "order_status_history":
      return prisma.orderStatusHistory.count();
    case "audit_logs":
      return prisma.auditLog.count();
    default:
      throw new Error(`Unknown table: ${name}`);
  }
}
