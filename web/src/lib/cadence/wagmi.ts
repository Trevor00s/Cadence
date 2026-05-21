import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { arcTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Cadence",
  // Default WalletConnect projectId placeholder; injected wallets still work.
  projectId: "cadence_arc_demo",
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});
