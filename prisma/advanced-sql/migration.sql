-- ============================================================================
-- FoodFlow DBMS — Advanced SQL objects (MySQL 8 only)
-- ============================================================================
-- HOW TO APPLY (on the Railway MySQL database):
--   mysql -h <host> -u <user> -p food_ordering_db < prisma/advanced-sql/migration.sql
--   -- or --
--   npx prisma migrate dev --name advanced_sql   (then copy this file in)
--
-- NOT applied in the SQLite fallback: CHECK constraints, stored procedures
-- and triggers in this file are MySQL 8 syntax and are NOT part of the
-- Prisma schema. Prisma migrations create the tables; this file adds the
-- advanced objects on top of a MySQL database.
--
-- *** DEMO-ONLY TRIGGERS — READ BEFORE APPLYING ***
-- The application itself writes rows to `order_status_history` and
-- `audit_logs` (single source of truth — see documentation/db-objects.md).
-- The two triggers below (trg_order_status_history, trg_inventory_audit)
-- are provided for academic demonstration of triggers. They MUST NOT be
-- applied together with the application writer, or every status change /
-- inventory update will be logged TWICE. Apply them only in a scratch
-- database for the DBMS lab demo, never in production.
--
-- This file contains NO `DELIMITER` command: each CREATE PROCEDURE /
-- CREATE TRIGGER is a single statement using BEGIN ... END, which the
-- `mysql` command-line client and Prisma's migration runner accept.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CHECK constraints (enforce domain rules at the database layer)
-- ---------------------------------------------------------------------------
ALTER TABLE reviews
  ADD CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE inventory
  ADD CONSTRAINT chk_inventory_stock_nonnegative CHECK (stock_qty >= 0);

ALTER TABLE orders
  ADD CONSTRAINT chk_orders_total_nonnegative CHECK (total_amount >= 0);

ALTER TABLE coupons
  ADD CONSTRAINT chk_coupons_discount_range CHECK (discount_percent BETWEEN 0 AND 100);

-- ---------------------------------------------------------------------------
-- 2. Views — read-only reporting queries
-- ---------------------------------------------------------------------------

-- Per-customer order history: one row per order with restaurant, totals
-- and the latest delivery status.
CREATE OR REPLACE VIEW v_customer_order_history AS
SELECT
  o.id AS order_id,
  o.user_id,
  u.name AS customer_name,
  o.restaurant_id,
  r.name AS restaurant_name,
  o.status,
  o.subtotal,
  o.delivery_fee,
  o.tax_amount,
  o.discount_amount,
  o.total_amount,
  o.coupon_code,
  o.placed_at,
  (SELECT d.status FROM deliveries d WHERE d.order_id = o.id ORDER BY d.id DESC LIMIT 1) AS delivery_status
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN restaurants r ON r.id = o.restaurant_id;

-- Per-restaurant sales summary: orders, revenue and average order value.
CREATE OR REPLACE VIEW v_restaurant_sales AS
SELECT
  r.id AS restaurant_id,
  r.name AS restaurant_name,
  r.city,
  COUNT(o.id) AS total_orders,
  COALESCE(SUM(CASE WHEN o.status <> 'CANCELLED' THEN o.total_amount ELSE 0 END), 0) AS revenue,
  COALESCE(AVG(CASE WHEN o.status <> 'CANCELLED' THEN o.total_amount ELSE NULL END), 0) AS avg_order_value,
  COALESCE(SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_orders
FROM restaurants r
LEFT JOIN orders o ON o.restaurant_id = r.id
GROUP BY r.id, r.name, r.city;

-- Most-ordered dishes, ranked by quantity sold and revenue.
-- Cancelled orders are excluded: the join to orders only matches
-- non-cancelled orders, and aggregates count only matched rows.
CREATE OR REPLACE VIEW v_popular_foods AS
SELECT
  f.id AS food_item_id,
  f.name AS food_name,
  f.restaurant_id,
  r.name AS restaurant_name,
  f.price,
  COUNT(o.id) AS times_ordered,
  COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.qty ELSE 0 END), 0) AS total_qty_sold,
  COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.line_total ELSE 0 END), 0) AS total_revenue
FROM food_items f
JOIN restaurants r ON r.id = f.restaurant_id
LEFT JOIN order_items oi ON oi.food_item_id = f.id
LEFT JOIN orders o ON o.id = oi.order_id AND o.status <> 'CANCELLED'
GROUP BY f.id, f.name, f.restaurant_id, r.name, f.price
ORDER BY total_qty_sold DESC;

-- Monthly revenue (delivered / non-cancelled orders only).
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT
  DATE_FORMAT(o.placed_at, '%Y-%m') AS month,
  COUNT(o.id) AS orders_count,
  COALESCE(SUM(o.total_amount), 0) AS revenue,
  COALESCE(SUM(o.discount_amount), 0) AS discounts_given
FROM orders o
WHERE o.status <> 'CANCELLED'
GROUP BY DATE_FORMAT(o.placed_at, '%Y-%m')
ORDER BY month;

-- ---------------------------------------------------------------------------
-- 3. Stored procedures — parameterised reporting
-- ---------------------------------------------------------------------------

-- Order history for one customer (newest first).
DELIMITER //
CREATE PROCEDURE sp_customer_order_history(IN p_user_id INT)
BEGIN
  SELECT
    order_id, restaurant_name, status, total_amount, coupon_code,
    delivery_status, placed_at
  FROM v_customer_order_history
  WHERE user_id = p_user_id
  ORDER BY placed_at DESC;
END //
DELIMITER ;

-- Revenue for one restaurant in a date range (inclusive).
DELIMITER //
CREATE PROCEDURE sp_restaurant_revenue(IN p_restaurant_id INT, IN p_from DATE, IN p_to DATE)
BEGIN
  SELECT
    r.id AS restaurant_id,
    r.name AS restaurant_name,
    COUNT(o.id) AS orders_count,
    COALESCE(SUM(o.total_amount), 0) AS revenue,
    COALESCE(AVG(o.total_amount), 0) AS avg_order_value,
    COALESCE(SUM(o.discount_amount), 0) AS discounts_given
  FROM restaurants r
  LEFT JOIN orders o
    ON o.restaurant_id = r.id
    AND o.status <> 'CANCELLED'
    AND DATE(o.placed_at) BETWEEN p_from AND p_to
  WHERE r.id = p_restaurant_id
  GROUP BY r.id, r.name;
END //
DELIMITER ;

-- ---------------------------------------------------------------------------
-- 4. Triggers — DEMO ONLY (see header). Do NOT apply with the app writer.
-- ---------------------------------------------------------------------------

-- DEMO ONLY: mirrors order status changes into order_status_history.
-- The application already does this; applying both double-logs history.
-- DEMO ONLY (commented out — app writes order_status_history itself):
-- CREATE TRIGGER trg_order_status_history
-- AFTER UPDATE ON orders
-- FOR EACH ROW
-- BEGIN
--   IF OLD.status <> NEW.status THEN
--     INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, created_at)
--     VALUES (NEW.id, OLD.status, NEW.status, NULL, NOW());
--   END IF;
-- END;

-- DEMO ONLY: audits inventory changes into audit_logs.
-- The application writes audit entries for admin inventory actions itself.
-- DEMO ONLY (commented out — app writes audit entries itself):
-- CREATE TRIGGER trg_inventory_audit
-- AFTER UPDATE ON inventory
-- FOR EACH ROW
-- BEGIN
--   IF OLD.stock_qty <> NEW.stock_qty THEN
--     INSERT INTO audit_logs (user_id, action, entity, entity_id, details, created_at)
--     VALUES (NULL, 'INVENTORY_UPDATED', 'inventory', NEW.id,
--             CONCAT('stock_qty changed from ', OLD.stock_qty, ' to ', NEW.stock_qty),
--             NOW());
--   END IF;
-- END;

-- ---------------------------------------------------------------------------
-- 5. Indexes — hot query paths (beyond those Prisma already creates)
-- ---------------------------------------------------------------------------
CREATE INDEX idx_orders_user_status ON orders (user_id, status);
CREATE INDEX idx_food_items_restaurant_category ON food_items (restaurant_id, category_id);
