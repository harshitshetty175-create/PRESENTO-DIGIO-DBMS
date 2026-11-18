export type Role =
  | "CUSTOMER"
  | "RESTAURANT_ADMIN"
  | "DELIVERY_PARTNER"
  | "SUPER_ADMIN";

export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REJECTED";

export type PaymentMethod = "COD" | "UPI_SIMULATED" | "CARD_SIMULATED";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

export type VegType = "VEG" | "NON_VEG" | "VEGAN";

export interface SessionUser {
  id: number;
  email: string;
  role: Role;
  name: string;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface CartItemDTO {
  id: number;
  foodItemId: number;
  name: string;
  price: number;
  qty: number;
  lineTotal: number;
  restaurantId: number;
  imageUrl: string | null;
  isVeg: boolean;
}

export interface CartDTO {
  id: number | null;
  restaurantId: number | null;
  items: CartItemDTO[];
  subtotal: number;
}

export interface OrderItemDTO {
  id: number;
  foodItemId: number | null;
  itemName: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface OrderDTO {
  id: number;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  couponCode: string | null;
  instructions: string | null;
  restaurantId: number;
  placedAt: string;
  items: OrderItemDTO[];
}

export interface RestaurantDTO {
  id: number;
  name: string;
  description: string | null;
  cuisine: string;
  city: string;
  rating: number;
  deliveryFee: number;
  deliveryMins: number;
  isOpen: boolean;
  foodItemCount: number;
}
