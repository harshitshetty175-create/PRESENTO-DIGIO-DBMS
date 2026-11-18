"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Database,
  LogOut,
  Menu,
  Moon,
  Search,
  ShoppingCart,
  Sun,
  User,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useToast } from "./Toast";
import type { CartData, CurrentUser, NotificationItem } from "./types";
import { unwrapArray, unwrapObject } from "./types";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/restaurants", label: "Restaurants" },
  { href: "/orders", label: "Orders" },
  { href: "/lab", label: "DBMS Lab" },
];

function roleHome(role: string): string {
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

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const loadCartCount = useCallback(async () => {
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) {
        setCartCount(0);
        return;
      }
      const data = await res.json();
      const cart = unwrapObject<CartData>(data, "cart");
      const items = cart?.items ?? [];
      setCartCount(items.reduce((sum, item) => sum + (item.qty ?? 0), 0));
    } catch {
      setCartCount(0);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      const list = unwrapArray<NotificationItem>(data, "notifications");
      setUnread(list.filter((n) => !n.is_read).length);
    } catch {
      // Notifications are best-effort; leave the badge hidden on failure.
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(unwrapObject<CurrentUser>(data, "user"));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    loadUser();
    loadCartCount();
    loadNotifications();
  }, [loadUser, loadCartCount, loadNotifications, pathname]);

  useEffect(() => {
    const onCartUpdated = () => loadCartCount();
    window.addEventListener("foodflow:cart-updated", onCartUpdated);
    return () => window.removeEventListener("foodflow:cart-updated", onCartUpdated);
  }, [loadCartCount]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/restaurants${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Treat logout as done even if the request fails.
    }
    setUser(null);
    setCartCount(0);
    setUnread(0);
    setUserMenuOpen(false);
    pushToast("Logged out", "success");
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-cream/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="FoodFlow home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
            <UtensilsCrossed className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
            Food<span className="text-brand-500">Flow</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === link.href
                  ? "bg-brand-50 text-brand-700 dark:bg-stone-800 dark:text-brand-400"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={handleSearch} className="ml-auto hidden min-w-0 flex-1 max-w-xs items-center md:flex" role="search">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search restaurants or dishes…"
              aria-label="Search restaurants or dishes"
              className="w-full rounded-full border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-full p-2 text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {user && (
            <Link
              href="/profile"
              aria-label={`Notifications, ${unread} unread`}
              className="relative rounded-full p-2 text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}

          <Link
            href="/cart"
            aria-label={`Cart, ${cartCount} items`}
            className="relative rounded-full p-2 text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                className="flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                  <User className="h-4 w-4" />
                </span>
                <span className="hidden max-w-28 truncate sm:block">{user.name}</span>
                <ChevronDown className="hidden h-4 w-4 sm:block" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl bg-white py-1.5 shadow-lift ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800" role="menu">
                  <div className="border-b border-stone-100 px-4 py-2.5 dark:border-stone-800">
                    <p className="truncate text-sm font-semibold text-stone-900 dark:text-white">{user.name}</p>
                    <p className="truncate text-xs text-stone-500">{user.email}</p>
                  </div>
                  <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800">
                    My Profile
                  </Link>
                  <Link href="/orders" onClick={() => setUserMenuOpen(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800">
                    My Orders
                  </Link>
                  {user.role !== "CUSTOMER" && (
                    <Link href={roleHome(user.role)} onClick={() => setUserMenuOpen(false)} className="block px-4 py-2 text-sm font-medium text-brand-600 hover:bg-stone-50 dark:text-brand-400 dark:hover:bg-stone-800">
                      {user.role === "RESTAURANT_ADMIN" ? "Restaurant Dashboard" : user.role === "DELIVERY_PARTNER" ? "Delivery Dashboard" : "Admin Dashboard"}
                    </Link>
                  )}
                  <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <Link href="/login" className="btn-ghost">Log in</Link>
              <Link href="/register" className="btn-primary !px-4 !py-2">Sign up</Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="rounded-full p-2 text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-stone-200 bg-cream px-4 pb-4 pt-3 dark:border-stone-800 dark:bg-stone-950 lg:hidden">
          <form onSubmit={handleSearch} className="mb-3 md:hidden" role="search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search restaurants or dishes…"
                aria-label="Search restaurants or dishes"
                className="input !rounded-full !pl-9"
              />
            </div>
          </form>
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                {link.label === "DBMS Lab" && <Database className="h-4 w-4 text-brand-500" />}
                {link.label}
              </Link>
            ))}
            {!user && (
              <div className="mt-2 flex gap-2">
                <Link href="/login" onClick={() => setMenuOpen(false)} className="btn-secondary flex-1">Log in</Link>
                <Link href="/register" onClick={() => setMenuOpen(false)} className="btn-primary flex-1">Sign up</Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
