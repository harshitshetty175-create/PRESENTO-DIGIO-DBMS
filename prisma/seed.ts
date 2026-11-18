/**
 * FoodFlow DBMS — deterministic seed script.
 *
 * Usage:
 *   npx prisma db seed        (prisma.seed is set to `tsx prisma/seed.ts`)
 *   npm run db:seed
 *
 * Deterministic: all pseudo-random choices come from mulberry32(seed = 42),
 * so re-running the seed against the same schema produces the same data.
 * Idempotent-ish: every table is emptied first (deleteMany in reverse
 * dependency order), then re-inserted. Demo users are upserted by email.
 *
 * ALL seed accounts use password `Demo@1234` (local development only).
 * Demo accounts:
 *   customer@foodflow.in        CUSTOMER          "Demo Customer"
 *   restaurant@foodflow.in      RESTAURANT_ADMIN  "Demo Restaurant Owner" (owns Spice Route)
 *   delivery@foodflow.in        DELIVERY_PARTNER  "Demo Rider"
 *   admin@foodflow.in           SUPER_ADMIN       "Demo Admin"
 *
 * Do NOT run against production. Do NOT edit prisma/schema.prisma.
 */
import { PrismaClient, Role, OrderStatus, PaymentMethod, PaymentStatus, DeliveryStatus, VegType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ */
/* Deterministic RNG (mulberry32, seed 42)                             */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const randInt = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* Fixed base time so seeded timestamps are deterministic              */
/* ------------------------------------------------------------------ */
const BASE = new Date("2026-11-01T09:00:00Z").getTime();
const hoursAfter = (h: number): Date => new Date(BASE + h * 60 * 60 * 1000);
const daysAfter = (d: number): Date => new Date(BASE + d * 24 * 60 * 60 * 1000);

/* ------------------------------------------------------------------ */
/* Static data                                                         */
/* ------------------------------------------------------------------ */
const DEMO_PASSWORD = "Demo@1234";

const CATEGORIES: Array<{ name: string; slug: string; image_url: string }> = [
  { name: "North Indian", slug: "north-indian", image_url: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80" },
  { name: "South Indian", slug: "south-indian", image_url: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=800&q=80" },
  { name: "Chinese", slug: "chinese", image_url: "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&q=80" },
  { name: "Italian", slug: "italian", image_url: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&q=80" },
  { name: "Fast Food", slug: "fast-food", image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80" },
  { name: "Desserts", slug: "desserts", image_url: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80" },
  { name: "Beverages", slug: "beverages", image_url: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80" },
  { name: "Biryani", slug: "biryani", image_url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80" },
  { name: "Street Food", slug: "street-food", image_url: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80" },
  { name: "Healthy", slug: "healthy", image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80" },
];

// Unsplash food photo IDs (reused across items is fine).
const IMG = {
  butterChicken: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80",
  biryani: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&q=80",
  rice: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80",
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
  pancakes: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
  salad: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
  icecream: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80",
  drink: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80",
  pasta: "https://images.unsplash.com/photo-1540189549336-e6e99c6d0d3c?w=800&q=80",
  dosa: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=800&q=80",
  noodles: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80",
  momos: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&q=80",
  sandwich: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80",
  fries: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80",
  curry: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
};

const CUSTOMER_NAMES = [
  "Aarav Sharma", "Priya Patel", "Rohan Mehta", "Ananya Iyer", "Vikram Reddy",
  "Sneha Kulkarni", "Arjun Nair", "Kavya Singh", "Aditya Joshi", "Meera Das",
  "Nikhil Gupta", "Divya Menon", "Karan Malhotra", "Pooja Verma", "Sanjay Rao",
  "Ritu Agarwal", "Manish Kumar", "Lakshmi Pillai", "Varun Kapoor", "Nisha Bose",
  "Amit Trivedi", "Shreya Bhatt", "Rahul Khanna", "Tanvi Desai", "Suresh Chandra",
];

const PARTNER_NAMES = [
  "Rajesh Kumar", "Imran Sheikh", "Suresh Yadav", "Deepak Singh", "Anil Gowda",
  "Mohammed Farhan", "Vijay Kumar", "Sandeep Reddy", "Kiran Bedi", "Arun Prakash",
];

const RESTAURANTS: Array<{
  name: string; cuisine: string; city: string; address: string; phone: string;
  deliveryFee: number; deliveryMins: number; description: string;
}> = [
  { name: "Spice Route", cuisine: "North Indian", city: "Bengaluru", address: "12, MG Road, Bengaluru 560001", phone: "+919900011111", deliveryFee: 29, deliveryMins: 35, description: "Authentic North Indian curries, tandoor and breads." },
  { name: "Dosa Plaza", cuisine: "South Indian", city: "Bengaluru", address: "45, Indiranagar 100 Ft Road, Bengaluru 560038", phone: "+919900022222", deliveryFee: 25, deliveryMins: 30, description: "Crispy dosas, fluffy idlis and filter coffee." },
  { name: "Dragon Wok", cuisine: "Chinese", city: "Bengaluru", address: "8, Koramangala 5th Block, Bengaluru 560095", phone: "+919900033333", deliveryFee: 35, deliveryMins: 40, description: "Indo-Chinese hakka noodles, momos and stir-fry." },
  { name: "Bella Italia", cuisine: "Italian", city: "Bengaluru", address: "22, Lavelle Road, Bengaluru 560001", phone: "+919900044444", deliveryFee: 39, deliveryMins: 45, description: "Wood-fired pizzas, fresh pasta and tiramisu." },
  { name: "Burger Barn", cuisine: "Fast Food", city: "Bengaluru", address: "3, HSR Layout Sector 2, Bengaluru 560102", phone: "+919900055555", deliveryFee: 19, deliveryMins: 25, description: "Smash burgers, loaded fries and thick shakes." },
];

// 10 items per restaurant: [name, price, vegType, categorySlug, image]
type ItemSpec = [string, number, VegType, string, string];
const MENU: Record<string, ItemSpec[]> = {
  "Spice Route": [
    ["Butter Chicken", 299, VegType.NON_VEG, "north-indian", IMG.butterChicken],
    ["Paneer Butter Masala", 249, VegType.VEG, "north-indian", IMG.curry],
    ["Chicken Biryani", 279, VegType.NON_VEG, "biryani", IMG.biryani],
    ["Dal Makhani", 199, VegType.VEG, "north-indian", IMG.curry],
    ["Tandoori Chicken (Half)", 329, VegType.NON_VEG, "north-indian", IMG.butterChicken],
    ["Veg Biryani", 199, VegType.VEG, "biryani", IMG.biryani],
    ["Butter Naan (2 pc)", 79, VegType.VEG, "north-indian", IMG.rice],
    ["Kadai Paneer", 259, VegType.VEG, "north-indian", IMG.curry],
    ["Gulab Jamun (4 pc)", 99, VegType.VEG, "desserts", IMG.icecream],
    ["Sweet Lassi", 89, VegType.VEG, "beverages", IMG.drink],
  ],
  "Dosa Plaza": [
    ["Masala Dosa", 119, VegType.VEG, "south-indian", IMG.dosa],
    ["Mysore Masala Dosa", 149, VegType.VEG, "south-indian", IMG.dosa],
    ["Idli Sambar (3 pc)", 89, VegType.VEG, "south-indian", IMG.dosa],
    ["Vada Sambar (2 pc)", 99, VegType.VEG, "south-indian", IMG.dosa],
    ["Rava Dosa", 159, VegType.VEG, "south-indian", IMG.dosa],
    ["Onion Uttapam", 139, VegType.VEG, "south-indian", IMG.dosa],
    ["Chicken Chettinad Dosa", 229, VegType.NON_VEG, "south-indian", IMG.dosa],
    ["Filter Coffee", 79, VegType.VEG, "beverages", IMG.drink],
    ["Curd Rice", 129, VegType.VEG, "south-indian", IMG.rice],
    ["Payasam", 109, VegType.VEG, "desserts", IMG.icecream],
  ],
  "Dragon Wok": [
    ["Hakka Noodles (Veg)", 179, VegType.VEG, "chinese", IMG.noodles],
    ["Chicken Hakka Noodles", 219, VegType.NON_VEG, "chinese", IMG.noodles],
    ["Veg Manchurian", 199, VegType.VEG, "chinese", IMG.noodles],
    ["Chicken Momos (8 pc)", 149, VegType.NON_VEG, "chinese", IMG.momos],
    ["Veg Momos (8 pc)", 129, VegType.VEG, "chinese", IMG.momos],
    ["Schezwan Fried Rice", 209, VegType.VEG, "chinese", IMG.rice],
    ["Chilli Chicken", 259, VegType.NON_VEG, "chinese", IMG.butterChicken],
    ["Hot & Sour Soup", 129, VegType.VEG, "chinese", IMG.noodles],
    ["Kung Pao Paneer", 239, VegType.VEG, "chinese", IMG.curry],
    ["Iced Green Tea", 99, VegType.VEG, "beverages", IMG.drink],
  ],
  "Bella Italia": [
    ["Margherita Pizza", 299, VegType.VEG, "italian", IMG.pizza],
    ["Pepperoni Pizza", 399, VegType.NON_VEG, "italian", IMG.pizza],
    ["Alfredo Pasta", 289, VegType.VEG, "italian", IMG.pasta],
    ["Arrabbiata Pasta", 269, VegType.VEG, "italian", IMG.pasta],
    ["Pesto Chicken Pasta", 349, VegType.NON_VEG, "italian", IMG.pasta],
    ["Garlic Bread (4 pc)", 149, VegType.VEG, "italian", IMG.pizza],
    ["Bruschetta", 179, VegType.VEG, "italian", IMG.pasta],
    ["Tiramisu", 199, VegType.VEG, "desserts", IMG.icecream],
    ["Caprese Salad", 229, VegType.VEG, "healthy", IMG.salad],
    ["Limoncello Cooler", 119, VegType.VEG, "beverages", IMG.drink],
  ],
  "Burger Barn": [
    ["Classic Smash Burger", 199, VegType.NON_VEG, "fast-food", IMG.burger],
    ["Veggie Crunch Burger", 149, VegType.VEG, "fast-food", IMG.burger],
    ["Double Cheese Burger", 279, VegType.NON_VEG, "fast-food", IMG.burger],
    ["Paneer Tikka Burger", 179, VegType.VEG, "fast-food", IMG.burger],
    ["Loaded Cheese Fries", 159, VegType.VEG, "fast-food", IMG.fries],
    ["Peri Peri Fries", 129, VegType.VEG, "fast-food", IMG.fries],
    ["Chicken Nuggets (6 pc)", 149, VegType.NON_VEG, "fast-food", IMG.burger],
    ["Grilled Chicken Sandwich", 189, VegType.NON_VEG, "fast-food", IMG.sandwich],
    ["Chocolate Thick Shake", 169, VegType.VEG, "beverages", IMG.drink],
    ["Pancake Stack with Maple", 199, VegType.VEG, "desserts", IMG.pancakes],
  ],
};

const COUPONS: Array<{
  code: string; description: string; discountPercent: number; maxDiscount: number; minOrder: number;
}> = [
  { code: "WELCOME20", description: "20% off your first order", discountPercent: 20, maxDiscount: 100, minOrder: 199 },
  { code: "FOODFLOW50", description: "Flat 50% off up to Rs.150", discountPercent: 50, maxDiscount: 150, minOrder: 499 },
  { code: "FREEDEL", description: "10% off up to Rs.40 (delivery delight)", discountPercent: 10, maxDiscount: 40, minOrder: 99 },
  { code: "VEG10", description: "10% off veg orders", discountPercent: 10, maxDiscount: 80, minOrder: 149 },
];

const REVIEW_COMMENTS = [
  "Absolutely delicious, will order again!",
  "Hot and fresh, delivered on time.",
  "Great taste, generous portions.",
  "Good food, packaging could be better.",
  "My go-to place for a quick dinner.",
  "Flavours were spot on. Highly recommended.",
  "Decent, but a little oily for my taste.",
  "Excellent service and tasty food!",
];

/** Plausible status path for a final order status (app-written history). */
const STATUS_PATH: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PLACED]: [OrderStatus.PLACED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PLACED, OrderStatus.CONFIRMED],
  [OrderStatus.PREPARING]: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PREPARING],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP],
  [OrderStatus.PICKED_UP]: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.PICKED_UP],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.PICKED_UP, OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.DELIVERED]: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.PICKED_UP, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED],
  [OrderStatus.CANCELLED]: [OrderStatus.PLACED, OrderStatus.CANCELLED],
  [OrderStatus.REJECTED]: [OrderStatus.PLACED, OrderStatus.REJECTED],
};

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */
async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1. Wipe existing data in reverse dependency order (FK-safe).
  await prisma.auditLog.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.couponUsage.deleteMany();
  await prisma.favourite.deleteMany();
  await prisma.review.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.foodItem.deleteMany();
  await prisma.deliveryPartner.deleteMany();
  await prisma.restaurantAdmin.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.address.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // 2. Categories (10).
  const categoryBySlug = new Map<string, number>();
  for (const c of CATEGORIES) {
    const created = await prisma.category.create({ data: c });
    categoryBySlug.set(c.slug, created.id);
  }

  // 3. Coupons (4).
  const couponByCode = new Map<string, { id: number; discountPercent: number; maxDiscount: number; minOrder: number }>();
  for (const c of COUPONS) {
    const created = await prisma.coupon.create({
      data: {
        code: c.code,
        description: c.description,
        discount_percent: c.discountPercent,
        max_discount: c.maxDiscount,
        min_order: c.minOrder,
        is_active: true,
        valid_from: daysAfter(0),
        valid_to: daysAfter(90),
      },
    });
    couponByCode.set(c.code, { id: created.id, discountPercent: c.discountPercent, maxDiscount: c.maxDiscount, minOrder: c.minOrder });
  }

  // 4. Users: demo accounts (upserted by email) + owners + customers + partners.
  const demoCustomer = await prisma.user.upsert({
    where: { email: "customer@foodflow.in" },
    update: { name: "Demo Customer", role: Role.CUSTOMER, password_hash: passwordHash },
    create: { name: "Demo Customer", email: "customer@foodflow.in", phone: "+919999900001", role: Role.CUSTOMER, password_hash: passwordHash },
  });
  const demoOwner = await prisma.user.upsert({
    where: { email: "restaurant@foodflow.in" },
    update: { name: "Demo Restaurant Owner", role: Role.RESTAURANT_ADMIN, password_hash: passwordHash },
    create: { name: "Demo Restaurant Owner", email: "restaurant@foodflow.in", phone: "+919999900002", role: Role.RESTAURANT_ADMIN, password_hash: passwordHash },
  });
  const demoRider = await prisma.user.upsert({
    where: { email: "delivery@foodflow.in" },
    update: { name: "Demo Rider", role: Role.DELIVERY_PARTNER, password_hash: passwordHash },
    create: { name: "Demo Rider", email: "delivery@foodflow.in", phone: "+919999900003", role: Role.DELIVERY_PARTNER, password_hash: passwordHash },
  });
  const demoAdmin = await prisma.user.upsert({
    where: { email: "admin@foodflow.in" },
    update: { name: "Demo Admin", role: Role.SUPER_ADMIN, password_hash: passwordHash },
    create: { name: "Demo Admin", email: "admin@foodflow.in", phone: "+919999900004", role: Role.SUPER_ADMIN, password_hash: passwordHash },
  });

  // One owner per restaurant; the demo owner owns Spice Route.
  const ownerIds: number[] = [demoOwner.id];
  for (let i = 2; i <= 5; i++) {
    const owner = await prisma.user.create({
      data: {
        name: `${RESTAURANTS[i - 1].name} Owner`,
        email: `owner${i}@foodflow.in`,
        phone: `+9199000${10000 + i}`,
        role: Role.RESTAURANT_ADMIN,
        password_hash: passwordHash,
      },
    });
    ownerIds.push(owner.id);
  }

  // 25 named customers: customer1@foodflow.in ... customer25@foodflow.in.
  const customerIds: number[] = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const customer = await prisma.user.create({
      data: {
        name: CUSTOMER_NAMES[i],
        email: `customer${i + 1}@foodflow.in`,
        phone: `+9198100${String(10000 + i)}`,
        role: Role.CUSTOMER,
        password_hash: passwordHash,
      },
    });
    customerIds.push(customer.id);
  }
  const allCustomerIds = [demoCustomer.id, ...customerIds];

  // 10 delivery partners + the demo rider.
  const partnerIds: number[] = [];
  for (let i = 0; i < PARTNER_NAMES.length; i++) {
    const user = await prisma.user.create({
      data: {
        name: PARTNER_NAMES[i],
        email: `partner${i + 1}@foodflow.in`,
        phone: `+9198200${String(10000 + i)}`,
        role: Role.DELIVERY_PARTNER,
        password_hash: passwordHash,
      },
    });
    const partner = await prisma.deliveryPartner.create({
      data: {
        user_id: user.id,
        vehicle_type: pick(["Bike", "Scooter", "Bicycle"] as const),
        vehicle_no: `KA-0${randInt(1, 5)}-${pick(["AB", "CD", "EF", "GH"] as const)}-${randInt(1000, 9999)}`,
        is_available: rand() > 0.2,
        rating: round2(3.8 + rand() * 1.2),
      },
    });
    partnerIds.push(partner.id);
  }
  const demoPartner = await prisma.deliveryPartner.create({
    data: { user_id: demoRider.id, vehicle_type: "Bike", vehicle_no: "KA-05-XY-4321", is_available: true, rating: 4.8 },
  });
  partnerIds.push(demoPartner.id);

  // 5. Restaurants (5) + admin links.
  const restaurantIds: number[] = [];
  for (let i = 0; i < RESTAURANTS.length; i++) {
    const r = RESTAURANTS[i];
    const created = await prisma.restaurant.create({
      data: {
        owner_id: ownerIds[i],
        name: r.name,
        description: r.description,
        cuisine: r.cuisine,
        address: r.address,
        city: r.city,
        phone: r.phone,
        image_url: CATEGORIES.find((c) => c.name === r.cuisine)?.image_url,
        rating: round2(3.9 + rand() * 0.9),
        delivery_fee: r.deliveryFee,
        min_order: 99,
        delivery_mins: r.deliveryMins,
        is_open: true,
        is_active: true,
      },
    });
    restaurantIds.push(created.id);
    await prisma.restaurantAdmin.create({ data: { restaurant_id: created.id, user_id: ownerIds[i] } });
  }

  // 6. Food items (50 = 10 per restaurant) + inventory (stock 0-30, a few low).
  type FoodRow = { id: number; restaurantId: number; name: string; price: number; vegType: VegType };
  const foods: FoodRow[] = [];
  const foodsByRestaurant = new Map<number, FoodRow[]>();
  for (let i = 0; i < RESTAURANTS.length; i++) {
    const restId = restaurantIds[i];
    const rows: FoodRow[] = [];
    for (const [name, price, vegType, catSlug, image] of MENU[RESTAURANTS[i].name]) {
      const categoryId = categoryBySlug.get(catSlug);
      if (categoryId === undefined) throw new Error(`Unknown category slug: ${catSlug}`);
      const item = await prisma.foodItem.create({
        data: {
          restaurant_id: restId,
          category_id: categoryId,
          name,
          description: `${name} from ${RESTAURANTS[i].name}.`,
          price,
          image_url: image,
          veg_type: vegType,
          is_available: true,
          is_veg: vegType !== VegType.NON_VEG,
          rating: round2(3.8 + rand() * 1.1),
        },
      });
      // A few deliberately low-stock items (stock 0-2); most are 6-30.
      const stock = rand() < 0.12 ? randInt(0, 2) : randInt(6, 30);
      await prisma.inventory.create({
        data: { food_item_id: item.id, stock_qty: stock, low_stock_at: 5 },
      });
      const row: FoodRow = { id: item.id, restaurantId: restId, name, price, vegType };
      foods.push(row);
      rows.push(row);
    }
    foodsByRestaurant.set(restId, rows);
  }

  // 7. Addresses: one default address per customer (26).
  const addressByUser = new Map<number, number>();
  const AREAS = ["Indiranagar", "Koramangala", "HSR Layout", "Whitefield", "Jayanagar", "Malleshwaram", "Electronic City", "JP Nagar"];
  for (const userId of allCustomerIds) {
    const address = await prisma.address.create({
      data: {
        user_id: userId,
        label: "Home",
        line1: `${randInt(1, 220)}, ${pick(AREAS)}`,
        city: "Bengaluru",
        pincode: `5600${randInt(10, 99)}`,
        is_default: true,
      },
    });
    addressByUser.set(userId, address.id);
  }

  // 8. Orders (30) with items, payments, deliveries, status history.
  const FINAL_STATUSES: OrderStatus[] = [
    ...Array<OrderStatus>(12).fill(OrderStatus.DELIVERED),
    ...Array<OrderStatus>(4).fill(OrderStatus.OUT_FOR_DELIVERY),
    ...Array<OrderStatus>(3).fill(OrderStatus.PREPARING),
    ...Array<OrderStatus>(3).fill(OrderStatus.CONFIRMED),
    ...Array<OrderStatus>(2).fill(OrderStatus.PLACED),
    ...Array<OrderStatus>(2).fill(OrderStatus.READY_FOR_PICKUP),
    ...Array<OrderStatus>(1).fill(OrderStatus.PICKED_UP),
    ...Array<OrderStatus>(3).fill(OrderStatus.CANCELLED),
  ];
  const couponCodes = ["WELCOME20", "FOODFLOW50", "FREEDEL", "VEG10"];
  const deliveredOrderIds: Array<{ orderId: number; userId: number; restaurantId: number; foodIds: number[] }> = [];
  let orderCount = 0;
  let paymentCount = 0;
  let deliveryCount = 0;
  let historyCount = 0;
  let couponUsageCount = 0;

  for (let n = 0; n < 30; n++) {
    const userId = pick(allCustomerIds);
    const restaurantId = pick(restaurantIds);
    const restaurant = RESTAURANTS[restaurantIds.indexOf(restaurantId)];
    const menu = foodsByRestaurant.get(restaurantId) ?? [];
    const status = FINAL_STATUSES[n];
    const placedAt = daysAfter(randInt(0, 16));

    // 1-4 distinct items, price snapshots copied from the menu.
    const itemCount = randInt(1, 4);
    const chosen = [...menu].sort(() => rand() - 0.5).slice(0, itemCount);
    const lines = chosen.map((f) => {
      const qty = randInt(1, 3);
      return { food_item_id: f.id, item_name: f.name, unit_price: f.price, qty, line_total: round2(f.price * qty) };
    });
    const subtotal = round2(lines.reduce((s, l) => s + l.line_total, 0));
    const deliveryFee = status === OrderStatus.CANCELLED ? 0 : restaurant.deliveryFee;

    // Coupon on ~1 in 3 orders, only when the subtotal clears the minimum.
    let couponCode: string | null = null;
    let discount = 0;
    if (rand() < 0.35) {
      const code = pick(couponCodes);
      const coupon = couponByCode.get(code);
      if (coupon && subtotal >= coupon.minOrder) {
        couponCode = code;
        discount = round2(Math.min((subtotal * coupon.discountPercent) / 100, coupon.maxDiscount));
      }
    }
    // Same money math as lib/utils.ts calcTotals: 5% tax on the DISCOUNTED
    // subtotal; total = subtotal - discount + deliveryFee + tax.
    const tax = round2(Math.max(0, subtotal - discount) * 0.05);
    const total = round2(subtotal - discount + deliveryFee + tax);

    const order = await prisma.order.create({
      data: {
        user_id: userId,
        restaurant_id: restaurantId,
        address_id: addressByUser.get(userId) ?? null,
        status,
        subtotal,
        delivery_fee: deliveryFee,
        tax_amount: tax,
        discount_amount: discount,
        total_amount: total,
        coupon_code: couponCode,
        instructions: rand() < 0.25 ? "Please keep it less spicy." : null,
        idempotency_key: `seed-order-${n + 1}`,
        placed_at: placedAt,
        created_at: placedAt,
        items: { create: lines },
      },
    });
    orderCount++;

    if (couponCode) {
      const coupon = couponByCode.get(couponCode);
      if (coupon) {
        await prisma.couponUsage.create({
          data: { coupon_id: coupon.id, user_id: userId, order_id: order.id, used_at: placedAt },
        });
        couponUsageCount++;
      }
    }

    // Payment: simulated methods succeed; COD stays PENDING until delivered.
    const method = pick([PaymentMethod.COD, PaymentMethod.UPI_SIMULATED, PaymentMethod.CARD_SIMULATED]);
    const isDelivered = status === OrderStatus.DELIVERED;
    const payStatus = method === PaymentMethod.COD ? (isDelivered ? PaymentStatus.SUCCESS : PaymentStatus.PENDING) : PaymentStatus.SUCCESS;
    const reference =
      method === PaymentMethod.COD
        ? `COD-${order.id}`
        : `SIM-${method === PaymentMethod.UPI_SIMULATED ? "UPI" : "CARD"}-${String(order.id).padStart(6, "0")}`;
    await prisma.payment.create({
      data: { order_id: order.id, amount: total, method, reference, status: payStatus, created_at: placedAt },
    });
    paymentCount++;

    // Delivery for every non-cancelled order.
    if (status !== OrderStatus.CANCELLED && status !== OrderStatus.REJECTED) {
      const partnerId = pick(partnerIds);
      const dStatus =
        status === OrderStatus.DELIVERED ? DeliveryStatus.DELIVERED
        : status === OrderStatus.OUT_FOR_DELIVERY ? DeliveryStatus.OUT_FOR_DELIVERY
        : status === OrderStatus.PICKED_UP ? DeliveryStatus.PICKED_UP
        : DeliveryStatus.ASSIGNED;
      await prisma.delivery.create({
        data: {
          order_id: order.id,
          partner_id: partnerId,
          status: dStatus,
          assigned_at: new Date(placedAt.getTime() + 10 * 60 * 1000),
          accepted_at: status === OrderStatus.PLACED || status === OrderStatus.CONFIRMED ? null : new Date(placedAt.getTime() + 15 * 60 * 1000),
          picked_up_at: status === OrderStatus.PICKED_UP || status === OrderStatus.OUT_FOR_DELIVERY || isDelivered ? new Date(placedAt.getTime() + 35 * 60 * 1000) : null,
          delivered_at: isDelivered ? new Date(placedAt.getTime() + 55 * 60 * 1000) : null,
        },
      });
      deliveryCount++;
    }

    // Status history written by the APP (single source of truth — see documentation/db-objects.md).
    const path = STATUS_PATH[status];
    for (let s = 0; s < path.length; s++) {
      await prisma.orderStatusHistory.create({
        data: {
          order_id: order.id,
          old_status: s === 0 ? null : path[s - 1],
          new_status: path[s],
          changed_by: s === 0 ? userId : null,
          created_at: new Date(placedAt.getTime() + s * 8 * 60 * 1000),
        },
      });
      historyCount++;
    }

    if (isDelivered) {
      deliveredOrderIds.push({ orderId: order.id, userId, restaurantId, foodIds: lines.map((l) => l.food_item_id) });
    }
  }

  // 9. Reviews (15) on delivered orders.
  let reviewCount = 0;
  for (let i = 0; i < 15 && i < deliveredOrderIds.length; i++) {
    const d = deliveredOrderIds[i];
    await prisma.review.create({
      data: {
        user_id: d.userId,
        restaurant_id: d.restaurantId,
        food_item_id: d.foodIds[0],
        order_id: d.orderId,
        rating: i === 6 ? 3 : randInt(4, 5),
        comment: REVIEW_COMMENTS[i % REVIEW_COMMENTS.length],
        created_at: hoursAfter(randInt(24, 300)),
      },
    });
    reviewCount++;
  }

  // 10. Favourites (20 unique customer x food pairs).
  const favSeen = new Set<string>();
  let favCount = 0;
  while (favCount < 20) {
    const userId = pick(allCustomerIds);
    const food = pick(foods);
    const key = `${userId}:${food.id}`;
    if (favSeen.has(key)) continue;
    favSeen.add(key);
    await prisma.favourite.create({ data: { user_id: userId, food_item_id: food.id } });
    favCount++;
  }

  // 11. Notifications (a few per demo + sampled customers).
  let notifCount = 0;
  const notifTargets = [demoCustomer.id, demoOwner.id, demoRider.id, ...customerIds.slice(0, 5)];
  for (const userId of notifTargets) {
    await prisma.notification.create({
      data: { user_id: userId, title: "Welcome to FoodFlow", body: "Order from 5 restaurants across Bengaluru.", type: "SYSTEM", created_at: daysAfter(0) },
    });
    notifCount++;
    if (userId === demoCustomer.id) {
      await prisma.notification.create({
        data: { user_id: userId, title: "Order delivered", body: "Your order from Spice Route was delivered. Enjoy!", type: "ORDER", created_at: daysAfter(2) },
      });
      notifCount++;
    }
  }

  // 12. Audit logs (a few representative entries).
  const auditRows: Array<{ user_id: number | null; action: string; entity: string; entity_id: number | null; details: string }> = [
    { user_id: demoAdmin.id, action: "SEED", entity: "system", entity_id: null, details: "Database seeded with demo data (seed=42)." },
    { user_id: demoOwner.id, action: "CREATE", entity: "restaurant", entity_id: restaurantIds[0], details: "Spice Route created." },
    { user_id: demoCustomer.id, action: "ORDER_PLACED", entity: "order", entity_id: deliveredOrderIds[0]?.orderId ?? null, details: "First seeded order placed." },
    { user_id: demoRider.id, action: "DELIVERY_ACCEPTED", entity: "delivery", entity_id: null, details: "Demo rider accepted a delivery." },
    { user_id: null, action: "COUPON_CREATED", entity: "coupon", entity_id: null, details: "WELCOME20 / FOODFLOW50 / FREEDEL / VEG10 created." },
  ];
  for (const row of auditRows) {
    await prisma.auditLog.create({ data: row });
  }

  // 13. Row counts.
  const counts = {
    users: await prisma.user.count(),
    customers: await prisma.user.count({ where: { role: Role.CUSTOMER } }),
    restaurantOwners: await prisma.user.count({ where: { role: Role.RESTAURANT_ADMIN } }),
    deliveryPartners: await prisma.deliveryPartner.count(),
    categories: await prisma.category.count(),
    restaurants: await prisma.restaurant.count(),
    foodItems: await prisma.foodItem.count(),
    inventory: await prisma.inventory.count(),
    addresses: await prisma.address.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
    payments: await prisma.payment.count(),
    deliveries: await prisma.delivery.count(),
    orderStatusHistory: await prisma.orderStatusHistory.count(),
    reviews: await prisma.review.count(),
    favourites: await prisma.favourite.count(),
    coupons: await prisma.coupon.count(),
    couponUsages: await prisma.couponUsage.count(),
    notifications: await prisma.notification.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  console.log("FoodFlow seed complete (deterministic, seed=42):");
  for (const [key, value] of Object.entries(counts)) console.log(`  ${key}: ${value}`);
  console.log("Demo accounts (password Demo@1234, local dev only): customer@foodflow.in / restaurant@foodflow.in / delivery@foodflow.in / admin@foodflow.in");
}

main()
  .catch((e: unknown) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
