import { defineChain } from "viem";

export const ARC_TESTNET = {
  id: 5042002,
  rpc: "https://rpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app",
  subscriptionManager: "0xf6836Ddf0A2fdE3712d057de86b14B259d0d429F" as const,
  usdc: "0x3600000000000000000000000000000000000000" as const,
  eurc: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as const,
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const,
};

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
  testnet: true,
});

export const subscriptionManagerAbi = [
  {
    type: "function",
    name: "createPlan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "period", type: "uint48" },
      { name: "bountyBps", type: "uint16" },
    ],
    outputs: [{ name: "planId", type: "uint256" }],
  },
  {
    type: "function",
    name: "deactivatePlan",
    stateMutability: "nonpayable",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "subscribe",
    stateMutability: "nonpayable",
    inputs: [
      { name: "planId", type: "uint256" },
      {
        name: "permitSingle",
        type: "tuple",
        components: [
          {
            name: "details",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint160" },
              { name: "expiration", type: "uint48" },
              { name: "nonce", type: "uint48" },
            ],
          },
          { name: "spender", type: "address" },
          { name: "sigDeadline", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "subId", type: "uint256" }],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "subId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "charge",
    stateMutability: "nonpayable",
    inputs: [{ name: "subId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isDue",
    stateMutability: "view",
    inputs: [{ name: "subId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "nextPlanId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "nextSubId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "plans",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "merchant", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "period", type: "uint48" },
      { name: "bountyBps", type: "uint16" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "subscriptions",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "planId", type: "uint256" },
      { name: "subscriber", type: "address" },
      { name: "nextCharge", type: "uint48" },
      { name: "createdAt", type: "uint48" },
      { name: "cancelled", type: "bool" },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export const permit2Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;
