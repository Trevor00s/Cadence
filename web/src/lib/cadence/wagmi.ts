import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { arcTestnet } from "./chain";

// WalletConnect projectId is only needed if you re enable the WalletConnect
// wallet. Injected, MetaMask, Rainbow (extension), and Coinbase (extension)
// all work without it. Set VITE_WALLETCONNECT_PROJECT_ID in your env to
// re enable mobile wallets via WalletConnect.
const projectId =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ||
  "cadence_arc_demo";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, injectedWallet, rainbowWallet, coinbaseWallet],
    },
  ],
  {
    appName: "Cadence Drip",
    projectId,
  },
);

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors,
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
  },
  ssr: false,
});
