import { z } from "zod";

export const roleSchema = z.enum([
  "CUSTOMER",
  "RESTAURANT_ADMIN",
  "DELIVERY_PARTNER",
]);

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  phone: z.string().trim().min(6).max(20).optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: roleSchema.optional().default("CUSTOMER"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(60),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(80),
  pincode: z.string().trim().min(4).max(10),
  is_default: z.boolean().optional().default(false),
});

export const cartAddSchema = z.object({
  foodItemId: z.number().int().positive(),
  qty: z.number().int().min(1).max(20).default(1),
});

export const cartUpdateSchema = z.object({
  foodItemId: z.number().int().positive(),
  qty: z.number().int().min(0).max(20),
});

export const paymentMethodSchema = z.enum([
  "COD",
  "UPI_SIMULATED",
  "CARD_SIMULATED",
]);

export const checkoutSchema = z.object({
  addressId: z.number().int().positive().optional(),
  couponCode: z.string().trim().max(40).optional(),
  instructions: z.string().trim().max(300).optional(),
  paymentMethod: paymentMethodSchema,
  idempotencyKey: z.string().uuid("idempotencyKey must be a UUID"),
});

export const restaurantSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(5000).optional(),
  cuisine: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(250),
  city: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(20).optional(),
  image_url: z.string().trim().url().max(500).optional(),
  delivery_fee: z.number().min(0).optional(),
  min_order: z.number().min(0).optional(),
  delivery_mins: z.number().int().min(1).max(300).optional(),
});

export const restaurantPatchSchema = restaurantSchema.partial().extend({
  is_open: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export const foodSchema = z.object({
  restaurantId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000).optional(),
  price: z.number().positive(),
  image_url: z.string().trim().url().max(500).optional(),
  veg_type: z.enum(["VEG", "NON_VEG", "VEGAN"]).optional().default("VEG"),
  is_veg: z.boolean().optional().default(true),
  stock_qty: z.number().int().min(0).optional().default(20),
});

export const foodPatchSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(5000).optional(),
  price: z.number().positive().optional(),
  image_url: z.string().trim().url().max(500).optional(),
  veg_type: z.enum(["VEG", "NON_VEG", "VEGAN"]).optional(),
  is_veg: z.boolean().optional(),
  is_available: z.boolean().optional(),
  category_id: z.number().int().positive().optional(),
});

export const reviewSchema = z.object({
  restaurantId: z.number().int().positive(),
  foodItemId: z.number().int().positive().optional(),
  orderId: z.number().int().positive().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .transform((v) => v.toUpperCase()),
  description: z.string().trim().max(200).optional(),
  discount_percent: z.number().min(0).max(100),
  max_discount: z.number().min(0).default(0),
  min_order: z.number().min(0).default(0),
  is_active: z.boolean().optional().default(true),
  valid_from: z.string().datetime().optional(),
  valid_to: z.string().datetime().optional().nullable(),
});

export const couponValidateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotal: z.number().min(0),
});

export const orderStatusSchema = z.object({
  status: z.enum([
    "PLACED",
    "CONFIRMED",
    "PREPARING",
    "READY_FOR_PICKUP",
    "PICKED_UP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "REJECTED",
  ]),
});

export const favouriteSchema = z.object({
  foodItemId: z.number().int().positive(),
});

export const notificationPatchSchema = z.object({
  id: z.number().int().positive().optional(),
  all: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type FoodInput = z.infer<typeof foodSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type CouponInput = z.infer<typeof couponSchema>;
