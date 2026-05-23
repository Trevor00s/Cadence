# Integrating Cadence Drip in your SaaS

This guide is for developers shipping a SaaS who want to gate features behind a recurring USDC subscription, settled on Arc Network via the Cadence Drip protocol. It assumes you already have a product, you know your customers, and you want to replace (or sit alongside) a Stripe-style billing layer.

## What you get

- One Permit2 signature from your customer authorises every future renewal.
- Payments settle to your wallet directly. No custody, no holding period.
- Cancellation is a single on-chain transaction by the customer. You cannot block it, and you do not need to handle a "cancel" form yourself.
- Permissionless keepers trigger renewals. You can run your own (recommended) or rely on third parties earning the bounty.

## What you give up

- No card processing, no fiat off-ramp included. Your customers need a wallet with USDC on Arc.
- No KYC, refunds, disputes, or chargebacks at the protocol layer. If you need any of those, layer them yourself.
- Renewals only fire if at least one keeper calls `charge`. Run your own keeper for predictability.

## Cost

There is no protocol fee. Each charge splits two ways: the merchant cut and the keeper bounty that the merchant picked when creating the plan.

So a 10 USDC monthly charge with a default 50 bps bounty splits as:

| Recipient | Amount |
|---|---|
| Merchant | 9.95 USDC |
| Keeper (bountyBps you set, default 50 bps) | 0.05 USDC |

You pay gas for `createPlan`. Customers pay gas for `subscribe` and `cancel`. Keepers pay gas for `charge` and recover it from their bounty.

## Vocabulary

- **Plan**: a (token, amount, period) tuple owned by a merchant address. You create one per pricing tier.
- **Subscription**: one customer's commitment to a plan. Identified by `subId`.
- **Manager**: the deployed `SubscriptionManager` contract. On Arc testnet, `0xc380A064cdF1511bDEd89e60455DB52865a273Bf`.

## Three integration paths

### Path 1: hosted redirect (10 minutes)

Simplest. Send your customer to the Cadence Drip hosted checkout with a query param, listen for completion off-chain or just trust the on-chain state.

```ts
// In your pricing page handler
const planId = 7n // the plan you created once via /merchant
const wallet = userWallet  // already known from your sign-in flow
const checkoutUrl = `https://cadence.example/subscribe?plan=${planId}&return=${encodeURIComponent(
  'https://your-saas.com/billing/return'
)}`
res.redirect(checkoutUrl)
```

On `/billing/return`, your backend reads on-chain whether `wallet` now has an active subscription to `planId` (see "Backend gating" below). If yes, unlock the feature.

Pros: zero frontend code. Cons: customer leaves your domain.

### Path 2: embed the subscribe flow in your own UI

Use the Cadence Drip SDK to drive Permit2 approval, signature, and the `subscribe` transaction from inside your own React app. The customer never leaves your site.

Install:

```bash
yarn add github:trevor00s/cadence#path:packages/sdk viem wagmi
```

(The SDK is published from GitHub, not the npm registry. This keeps the supply-chain surface small.)

Frontend component:

```tsx
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import {
  arcTestnet,
  arcTestnetAddresses,
  buildSubscribePermit,
  cadenceDeployments,
  erc20Abi,
  getPermit2Nonce,
  PERMIT2_ADDRESS,
  subscriptionManagerAbi,
} from '@cadence/sdk'

const MANAGER = cadenceDeployments[arcTestnet.id]!.subscriptionManager
const USDC = arcTestnetAddresses.usdc

export function SubscribeButton({ planId }: { planId: bigint }) {
  const { address } = useAccount()
  const publicClient = usePublicClient()!
  const { data: walletClient } = useWalletClient()

  async function subscribe() {
    if (!address || !walletClient) return

    // 1. Ensure USDC.approve(Permit2) has been called once, ever, for this wallet.
    const allowance = (await publicClient.readContract({
      address: USDC, abi: erc20Abi, functionName: 'allowance',
      args: [address, PERMIT2_ADDRESS],
    })) as bigint
    if (allowance < (1n << 200n)) {
      const tx = await walletClient.writeContract({
        address: USDC, abi: erc20Abi, functionName: 'approve',
        args: [PERMIT2_ADDRESS, (1n << 256n) - 1n],
      })
      await publicClient.waitForTransactionReceipt({ hash: tx })
    }

    // 2. Build and sign the Permit2 typed data.
    const nonce = await getPermit2Nonce(publicClient, address, USDC, MANAGER)
    const { permitSingle, typedData } = buildSubscribePermit({
      owner: address, token: USDC, spender: MANAGER, nonce,
      chainId: arcTestnet.id,
    })
    const signature = await walletClient.signTypedData({
      account: address,
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
    })

    // 3. Submit subscribe(). First charge executes in the same tx.
    const hash = await walletClient.writeContract({
      address: MANAGER, abi: subscriptionManagerAbi,
      functionName: 'subscribe',
      args: [planId, permitSingle, signature],
    })
    await publicClient.waitForTransactionReceipt({ hash })
  }

  return <button onClick={subscribe}>Subscribe</button>
}
```

Pros: native UX inside your product. Cons: you ship a frontend dependency on viem/wagmi.

### Path 3: direct contract calls (advanced)

If you already have your own wallet plumbing, skip the SDK and call the contract ABIs directly. The ABI is published in `packages/sdk/src/abi.ts` and is also available on ArcScan.

This is the same flow as Path 2, just without the helper functions. Use this if you have strong reasons (gas optimisation, custom UX, alternative signing flow like passkey AA).

## Backend gating

Your server needs one question answered: **is wallet X currently entitled to plan Y?** Two ways.

### Option A: on-demand read

For most apps this is enough. Read the contract from your backend (no key required, it is a view call).

```ts
import { createPublicClient, http } from 'viem'
import { arcTestnet, cadenceDeployments, hasActiveSubscription } from '@cadence/sdk'

const publicClient = createPublicClient({
  chain: arcTestnet, transport: http(),
})
const MANAGER = cadenceDeployments[arcTestnet.id]!.subscriptionManager

export async function isEntitled(wallet: `0x${string}`, planId: bigint) {
  return hasActiveSubscription(publicClient, MANAGER, wallet, planId)
}
```

Use this inside your auth middleware. Cache for 30 to 60 seconds; subscriptions do not change every request, and you pay one RPC per cache miss.

### Option B: event-indexed mirror

For high traffic, build a tiny indexer. Listen for `Subscribed`, `Charged`, `Cancelled`, and `PlanDeactivated` events from the manager. Mirror state into your Postgres/SQLite. Your auth path becomes a local DB read. This is what we recommend at scale.

Event signatures (truncated, see ABI for the full shape):

```
Subscribed(uint256 subId, uint256 planId, address subscriber)
Charged(uint256 subId, uint48 chargedAt, uint48 nextChargeAt,
        uint160 amountToMerchant, uint160 bountyToKeeper, address keeper)
Cancelled(uint256 subId, address by)
PlanDeactivated(uint256 planId)
```

Reorgs on Arc are short. A safety window of 5 blocks (a few seconds) is more than enough.

## Tying a wallet to your user account

Use Sign-In With Ethereum (EIP-4361). The flow:

1. Server issues a nonce.
2. Client signs a SIWE message including their wallet and your domain.
3. Server verifies the signature, stores `(userId, walletAddress)`.

After that, every authenticated request has both a userId and a walletAddress. Your `isEntitled(wallet, planId)` middleware is enough.

Do NOT use plain `signMessage` of an arbitrary string. SIWE guards against phishing and replay; rolling your own is a foot-gun.

## Subscription lifecycle and how to handle it

A subscription progresses through these states. The SDK exports a `SubscriptionState` union with five values.

| State | Meaning | What to do |
|---|---|---|
| `active` | Paid through the current period, `now < nextCharge`. | Grant access. |
| `due` | `now >= nextCharge` and no charge yet. | Default: revoke access until charge lands. Optionally grant a grace window of N hours. |
| `cancelled` | Customer revoked. | Revoke access. Optionally let them re-subscribe to the same plan. |
| `plan_inactive` | Merchant deactivated the plan. | Revoke access. The customer cannot restart this plan. Migrate them to a new plan if you want. |
| `not_found` | `subId` does not exist. | Treat as no subscription. |

The SDK helper `getSubscriptionStatus(client, manager, subId)` returns this state plus an `isEntitled: boolean` shortcut.

## Running your own keeper

If a subscription is `due` and nobody calls `charge()`, no money moves and your customer is in limbo. Three options:

1. **Run the keeper in `keeper/`** (Node.js, polls every 30s, recovers gas + bounty automatically). Deploy as a small VM or Cloudflare Worker cron. One keeper per chain is enough.
2. **Trust the open market**. Anyone can call `charge()` for any due subscription and earns `bountyBps / 10_000` of the amount. If your plan has a non-trivial bounty (50 bps is a sane default), independent operators have an incentive to fire it. There is no SLA.
3. **Both**. Run your own keeper as the primary path; let the open market be the failover.

Recommendation: option 3 for any real production deployment.

## Pricing your plan

Three knobs on `createPlan`:

- **amount** (uint160, in token base units). For 10 USDC at 6 decimals: `10_000_000n`.
- **period** (uint48 seconds). One month is `30 * 24 * 60 * 60 = 2_592_000`. The contract enforces a minimum of 1 hour.
- **bountyBps** (uint16, max 1000). 50 bps (0.5%) is a sane default. Higher makes renewals fire faster in the open market. 0 means only your own keeper or a charitable third party will fire it.

You can have multiple plans (tiers). One `createPlan` per tier, store the `planId`s in your backend.

## What this protocol does NOT do for you

- **Refunds**. There is no `refund()` on the contract. If you want to refund a customer, send USDC from your wallet to theirs out of band, and treat it as your own bookkeeping.
- **Proration**. Charges are full-amount, full-period. If you change tiers, cancel the old sub and start a new one.
- **Trials**. There is no concept of a free period at the protocol level. Implement trials in your own app (grant access without requiring a Cadence Drip sub for the trial window, then redirect to subscribe).
- **Tax invoices**. The on-chain transactions are your receipts. If you need PDF invoices, render them yourself from the indexer mirror.

## Production checklist

Before pointing real customers at this:

- Plan and amount values are denominated in token base units. Sanity-check by reading `plans(planId)` after creation.
- Cache `isEntitled` reads for 30 to 60 seconds. Do not hammer the RPC per request.
- Subscribe and cancel actions need clear UI states (approving, signing, broadcasting, confirmed). Wallet UX is unforgiving.
- Watch for RPC failures. Have a fallback RPC URL. Cadence Drip does not depend on any centralised infra except whatever RPC you use.
- For mainnet, the contracts are pre-production and unaudited. Audit before deploying with real money.

## Reference

- Contract source: `contracts/src/SubscriptionManager.sol`.
- SDK source: `packages/sdk/src/`.
- Live deployment: `0xc380A064cdF1511bDEd89e60455DB52865a273Bf` on Arc Testnet (chain id 5042002).
- Block explorer: https://testnet.arcscan.app
- Permit2 canonical: `0x000000000022D473030F116dDEE9F6B43aC78BA3`.
- USDC ERC20 on Arc testnet: `0x3600000000000000000000000000000000000000` (6 decimals).
