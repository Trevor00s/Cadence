import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Moon, Sun } from "lucide-react";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);
  return (
    <button
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        setDark(next);
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rule text-muted-foreground hover:text-foreground hover:bg-muted"
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function ConnectSlot() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="h-9 w-32 rounded-md border border-rule bg-muted/40" />
    );
  }
  return <ConnectButton showBalance={false} chainStatus="icon" />;
}

export function Nav() {
  return (
    <header className="hairline-b sticky top-0 z-30 bg-background/85 backdrop-blur">
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-6 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-mono text-[15px] font-700 tracking-tight"
        >
          <span className="inline-block h-3 w-3 rounded-[2px] bg-[color:var(--accent-ink)]" />
          cadence
          <span className="text-muted-foreground font-500">/arc</span>
        </Link>
        <nav className="hidden md:flex items-center justify-center gap-7 text-[13px] text-muted-foreground">
          <Link
            to="/merchant"
            className="hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Merchant
          </Link>
          <Link
            to="/subscribe"
            className="hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Subscribe
          </Link>
          <Link
            to="/subscriptions"
            className="hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            My subscriptions
          </Link>
          <Link
            to="/docs"
            className="hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Docs
          </Link>
        </nav>
        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <ConnectSlot />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="hairline mt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid gap-6 md:grid-cols-3 text-[13px]">
        <div>
          <div className="font-mono text-foreground">cadence</div>
          <p className="mt-2 text-muted-foreground">
            Open protocol for recurring USDC subscriptions on Arc. No custody,
            no API keys.
          </p>
        </div>
        <div>
          <div className="text-muted-foreground mb-2">Contract</div>
          <a
            href="https://testnet.arcscan.app/address/0xc380A064cdF1511bDEd89e60455DB52865a273Bf"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[12px] break-all hover:text-[color:var(--accent-ink)]"
          >
            0xc380A064cdF1511bDEd89e60455DB52865a273Bf
          </a>
        </div>
        <div className="md:text-right">
          <div className="text-muted-foreground mb-2">Resources</div>
          <div className="flex md:justify-end gap-4">
            <a
              href="https://testnet.arcscan.app"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[color:var(--accent-ink)]"
            >
              ArcScan
            </a>
            <a
              href="https://github.com/trevor00s/cadence"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[color:var(--accent-ink)]"
            >
              GitHub
            </a>
            <Link
              to="/docs"
              className="hover:text-[color:var(--accent-ink)]"
            >
              Docs
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
