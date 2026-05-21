import type { Address } from 'viem'
import { defineChain } from 'viem'

export const arcTestnet = /*#__PURE__*/ defineChain({
  id: 5_042_002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
      webSocket: ['wss://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
      apiUrl: 'https://testnet.arcscan.app/api',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 0,
    },
  },
  testnet: true,
})

/// Token / infra addresses on Arc Testnet.
export const arcTestnetAddresses = {
  usdc: '0x3600000000000000000000000000000000000000' as Address,
  eurc: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as Address,
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
  multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11' as Address,
  cctpTokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as Address,
  cctpMessageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as Address,
} as const

/// Token decimals as exposed by the ERC20 surface on Arc.
/// USDC native gas reports 18, but the canonical USDC ERC20 (0x36...) reports 6.
export const TOKEN_DECIMALS = {
  usdc: 6,
  eurc: 6,
} as const

/// Cadence deployments. Populated after running script/Deploy.s.sol.
export const cadenceDeployments: Record<number, { subscriptionManager: Address } | undefined> = {
  [arcTestnet.id]: {
    subscriptionManager: '0xA147fD88f8daA76621560B99C346037750E9e718' as Address,
  },
}
