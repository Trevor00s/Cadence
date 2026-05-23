export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={
        "animate-pulse rounded-md bg-muted/60 " + className
      }
      aria-hidden
    />
  );
}

export function PlanCardSkeleton() {
  return (
    <div className="border border-rule rounded-md bg-card p-5 flex flex-col">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="mt-2 h-3 w-32" />
      <Skeleton className="mt-3 h-3 w-44" />
      <Skeleton className="mt-5 h-9 w-full" />
    </div>
  );
}

export function SubscriptionRowSkeleton() {
  return (
    <div className="border border-rule rounded-md bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}
