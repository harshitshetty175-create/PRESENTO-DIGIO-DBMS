/** Shared API shapes for the FoodFlow customer UI.
 *  Prisma Decimals arrive over JSON as number or string, so numeric
 *  fields are typed `number | string` and normalised with `num()`. */

/** Landing page for a role after login / registration. */
export function roleHome(role: string): string {
  switch (role) {
    case "RESTAURANT_ADMIN":
      return "/restaurant";
    case "DELIVERY_PARTNER":
      return "/delivery";
    case "SUPER_ADMIN":
      return "/admin";
    default:
      return "/";
  }
}

export function num(v: number | string | null | undefined, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  image_url?: string | null;
}

export interface Restaurant {
  id: number;
  name: string;
  description?: string | null;
  cuisine: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  image_url?: string | null;
  rating: number | string;
  avgRating?: number | string;
  delivery_fee: number | string;
  min_order?: number | string;
  delivery_mins: number;
  is_open: boolean;
  is_active?: boolean;
  reviews?: ReviewRow[];
  food_items?: FoodItem[];
}

export interface FoodItem {
  id: number;
  restaurant_id: number;
  category_id: number;
  name: string;
  description?: string | null;
  price: number | string;
  image_url?: string | null;
  veg_type?: string | null;
  is_veg?: boolean;
  is_available?: boolean;
  rating: number | string;
  category?: Category | string | null;
  restaurant?: Restaurant | null;
}

export interface Coupon {
  id: number;
  code: string;
  description?: string | null;
  discount_percent: number | string;
  max_discount?: number | string;
  min_order?: number | string;
  is_active?: boolean;
  valid_to?: string | null;
}

export interface Address {
  id: number;
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  pincode: string;
  is_default?: boolean;
}

export interface CartItemRow {
  id?: number;
  /** Real API shape is flat: foodItemId / name / price / imageUrl. */
  foodItemId?: number;
  food_item_id?: number;
  name?: string;
  imageUrl?: string | null;
  isVeg?: boolean;
  lineTotal?: number | string;
  restaurantId?: number;
  restaurantName?: string | null;
  foodItem?: FoodItem;
  food_item?: FoodItem;
  qty: number;
  unit_price?: number | string;
  price?: number | string;
}

/** Normalise a cart item regardless of flat vs nested API shape. */
export function cartFoodId(item: CartItemRow): number {
  return item.foodItemId ?? item.food_item_id ?? item.foodItem?.id ?? item.food_item?.id ?? 0;
}
export function cartItemPrice(item: CartItemRow): number {
  const food = item.foodItem ?? item.food_item;
  return num(item.price ?? item.unit_price ?? food?.price);
}
export function cartItemName(item: CartItemRow): string {
  const food = item.foodItem ?? item.food_item;
  return item.name ?? food?.name ?? "Item";
}
export function cartItemImage(item: CartItemRow): string | null {
  const food = item.foodItem ?? item.food_item;
  return item.imageUrl ?? food?.image_url ?? null;
}
export function cartItemLineTotal(item: CartItemRow): number {
  return num(item.lineTotal, cartItemPrice(item) * item.qty);
}

export interface CartData {
  id?: number;
  restaurant_id?: number | null;
  /** Real cart API returns camelCase `restaurantId`. */
  restaurantId?: number | null;
  restaurant?: Restaurant | null;
  items: CartItemRow[];
  subtotal?: number | string;
  delivery_fee?: number | string;
  deliveryFee?: number | string;
  tax_amount?: number | string;
  tax?: number | string;
  discount_amount?: number | string;
  total?: number | string;
  total_amount?: number | string;
}

export interface OrderItemRow {
  id?: number;
  item_name?: string;
  name?: string;
  unit_price?: number | string;
  price?: number | string;
  qty: number;
  line_total?: number | string;
  food_item_id?: number | null;
  foodItem?: FoodItem | null;
  food_item?: { id?: number; name?: string } | null;
}

export interface PaymentRow {
  id?: number;
  method?: string;
  status?: string;
  amount?: number | string;
  reference?: string | null;
}

export interface StatusHistoryRow {
  id?: number;
  old_status?: string | null;
  new_status: string;
  created_at?: string;
}

export interface Order {
  id: number;
  status: string;
  subtotal: number | string;
  delivery_fee?: number | string;
  tax_amount?: number | string;
  discount_amount?: number | string;
  total_amount?: number | string;
  total?: number | string;
  coupon_code?: string | null;
  instructions?: string | null;
  placed_at?: string;
  created_at?: string;
  restaurant?: Restaurant | null;
  restaurant_id?: number;
  address?: Address | null;
  items?: OrderItemRow[];
  order_items?: OrderItemRow[];
  payments?: PaymentRow[];
  status_history?: StatusHistoryRow[];
}

export interface ReviewRow {
  id: number;
  rating: number;
  comment?: string | null;
  created_at?: string;
  restaurant_id?: number;
  restaurant?: Restaurant | null;
  food_item_id?: number | null;
  foodItem?: FoodItem | null;
  user?: { name?: string } | null;
}

export interface FavouriteRow {
  id?: number;
  food_item_id: number;
  foodItem?: FoodItem;
  food_item?: FoodItem;
}

export interface NotificationItem {
  id: number;
  title: string;
  body?: string | null;
  type?: string;
  is_read: boolean;
  created_at?: string;
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
}

/** Unwrap the common API envelope shapes: bare array, { data: [...] },
 *  or a named key such as { restaurants: [...] }. */
export function unwrapArray<T>(payload: unknown, key?: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (key && Array.isArray(obj[key])) return obj[key] as T[];
    for (const k of ["restaurants", "foods", "items", "orders", "categories", "coupons", "addresses", "favourites", "reviews", "notifications"]) {
      if (Array.isArray(obj[k])) return obj[k] as T[];
    }
  }
  return [];
}

export function unwrapObject<T>(payload: unknown, key?: string): T | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  if (key && obj[key] && typeof obj[key] === "object") return obj[key] as T;
  if (obj.data && typeof obj.data === "object") return obj.data as T;
  return payload as T;
}
