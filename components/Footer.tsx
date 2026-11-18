import Link from "next/link";
import { CreditCard, UtensilsCrossed } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
                <UtensilsCrossed className="h-5 w-5" />
              </span>
              <span className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
                Food<span className="text-brand-500">Flow</span>
              </span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              Order food online from restaurants near you — browse menus, track
              your order live, and pay on delivery or with a simulated payment.
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300">
              <CreditCard className="h-4 w-4 text-brand-500" />
              Simulated payments only — no real money moves here.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white">Explore</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/" className="text-stone-500 hover:text-brand-600 dark:text-stone-400">Home</Link></li>
              <li><Link href="/restaurants" className="text-stone-500 hover:text-brand-600 dark:text-stone-400">Restaurants</Link></li>
              <li><Link href="/orders" className="text-stone-500 hover:text-brand-600 dark:text-stone-400">My Orders</Link></li>
              <li><Link href="/cart" className="text-stone-500 hover:text-brand-600 dark:text-stone-400">Cart</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white">Account</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/login" className="text-stone-500 hover:text-brand-600 dark:text-stone-400">Log in</Link></li>
              <li><Link href="/register" className="text-stone-500 hover:text-brand-600 dark:text-stone-400">Sign up</Link></li>
              <li><Link href="/profile" className="text-stone-500 hover:text-brand-600 dark:text-stone-400">Profile &amp; Addresses</Link></li>
              <li><Link href="/dbms-lab" className="text-stone-500 hover:text-brand-600 dark:text-stone-400">DBMS Lab</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-stone-200 pt-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800 dark:text-stone-400">
          <p>Demo academic project — Dayananda Sagar University, CSE, DBMS 2026–27</p>
          <p>FoodFlow DBMS · Built with Next.js, Prisma &amp; MySQL</p>
        </div>
      </div>
    </footer>
  );
}
