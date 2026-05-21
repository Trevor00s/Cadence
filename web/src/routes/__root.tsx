import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";

import { Web3Providers } from "@/components/cadence/Providers";
import { Nav, Footer } from "@/components/cadence/Nav";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md">
        <div className="font-mono text-xs text-muted-foreground">404</div>
        <h1 className="mt-2 text-2xl font-700 tracking-tight">
          No route at this address.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page does not exist. Try the protocol entry points below.
        </p>
        <div className="mt-5 flex gap-3 text-sm">
          <Link to="/" className="underline underline-offset-4">
            Home
          </Link>
          <Link to="/docs" className="underline underline-offset-4">
            Docs
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md">
        <div className="font-mono text-xs text-[color:var(--accent-ink)]">
          error
        </div>
        <h1 className="mt-2 text-xl font-700 tracking-tight">
          Something failed loading this view.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground font-mono break-all">
          {error.message}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            Retry
          </button>
          <a
            href="/"
            className="rounded-md border border-rule px-3 py-1.5 text-sm hover:bg-muted"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Web3Providers>
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1">
            <Outlet />
          </main>
          <Footer />
        </div>
      </Web3Providers>
    </QueryClientProvider>
  );
}
