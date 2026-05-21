import { useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, lightTheme, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "@/lib/cadence/wagmi";
import { arcTestnet } from "@/lib/cadence/chain";

export function Web3Providers({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const sync = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        initialChain={arcTestnet}
        theme={
          isDark
            ? darkTheme({ accentColor: "#c2632a", borderRadius: "small" })
            : lightTheme({ accentColor: "#1a1d2e", borderRadius: "small" })
        }
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}

/** Wraps a subtree so wagmi hooks only run after hydration. */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted)
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  return <>{children}</>;
}
