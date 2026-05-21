import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cadence. Recurring USDC subscriptions on Arc." },
      {
        name: "description",
        content:
          "Open protocol for recurring USDC subscriptions on Arc. Permit2 authorization, no custody, no API keys, cancellable in one transaction.",
      },
      { property: "og:title", content: "Cadence. Recurring USDC subscriptions on Arc." },
      {
        property: "og:description",
        content:
          "One Permit2 signature. A public contract pulls payment on cadence. No custody, no API keys.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

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
