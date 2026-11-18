export function RestaurantSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="skeleton-shimmer h-44 w-full" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton-shimmer h-4 w-3/4 rounded" />
        <div className="skeleton-shimmer h-3 w-1/2 rounded" />
        <div className="skeleton-shimmer h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

export function FoodSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="skeleton-shimmer h-40 w-full" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton-shimmer h-4 w-2/3 rounded" />
        <div className="skeleton-shimmer h-3 w-full rounded" />
        <div className="skeleton-shimmer h-3 w-1/2 rounded" />
        <div className="flex items-center justify-between pt-1">
          <div className="skeleton-shimmer h-5 w-16 rounded" />
          <div className="skeleton-shimmer h-9 w-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function OrderSkeleton() {
  return (
    <div className="card p-5" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="skeleton-shimmer h-4 w-32 rounded" />
        <div className="skeleton-shimmer h-6 w-24 rounded-full" />
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="skeleton-shimmer h-3 w-full rounded" />
        <div className="skeleton-shimmer h-3 w-4/5 rounded" />
        <div className="skeleton-shimmer h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}
