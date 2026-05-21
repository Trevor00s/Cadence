import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ARC_TESTNET } from "@/lib/cadence/chain";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs. Cadence." },
      {
        name: "description",
        content:
          "Technical reference for Cadence, the open USDC subscription protocol on Arc. Contracts, flow, integration.",
      },
    ],
  }),
  component: DocsPage,
});

const sections = [
  { id: "quick-start", label: "Quick start" },
  { id: "what", label: "What Cadence is" },
  { id: "flow", label: "The flow" },
  { id: "permit2", label: "Why Permit2" },
  { id: "bounty", label: "Why a bounty model" },
  { id: "fee", label: "Protocol fee" },
  { id: "migrate", label: "Migrate from Stripe" },
  { id: "reference", label: "Contract reference" },
  { id: "paths", label: "Integration paths" },
  { id: "gating", label: "Backend gating" },
  { id: "wallet-binding", label: "Wallet binding" },
  { id: "lifecycle", label: "Lifecycle states" },
  { id: "keeper", label: "Running a keeper" },
  { id: "indexer", label: "Database indexer" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "pricing", label: "Plan pricing" },
  { id: "not-included", label: "Not included" },
  { id: "checklist", label: "Production checklist" },
  { id: "changelog", label: "Changelog" },
  { id: "audit", label: "Audit status" },
];

function useActiveSection() {
  const [active, setActive] = useState(sections[0].id);
  useEffect(() => {
    const handler = () => {
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < 120) current = s.id;
      }
      setActive(current);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return active;
}

function DocsPage() {
  const active = useActiveSection();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid lg:grid-cols-[200px_1fr] gap-10">
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <div className="text-[11px] uppercase tracking-[0.08em] font-600 text-muted-foreground mb-3">
            On this page
          </div>
          <nav className="space-y-1.5 text-[13px]">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={
                  "block border-l-2 pl-3 py-0.5 " +
                  (active === s.id
                    ? "border-[color:var(--accent-ink)] text-foreground font-600"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      <article className="max-w-[720px] prose-cadence">
        <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
          documentation
        </div>
        <h1 className="mt-2 text-[40px] tracking-[-0.025em] leading-[1.05] font-800">
          Cadence protocol.
        </h1>

        <Section id="quick-start" title="Quick start">
          <p>
            From zero to a paying subscriber in three steps. You need a wallet
            with a small amount of USDC on Arc Testnet for gas and the first
            charge.
          </p>
          <ol className="list-decimal pl-5 space-y-3">
            <li>
              <b>Create a plan.</b> Go to{" "}
              <code className="font-mono">/merchant</code>, connect your
              wallet, set amount and period, click Create plan. Save the
              returned planId.
            </li>
            <li>
              <b>Share the checkout link.</b>{" "}
              <code className="font-mono">
                /subscribe?plan=&lt;planId&gt;
              </code>{" "}
              works on its own or embedded as an iframe.
            </li>
            <li>
              <b>Gate your SaaS.</b> Install the SDK and call{" "}
              <code className="font-mono">hasActiveSubscription</code> from
              your auth middleware.
            </li>
          </ol>
          <Code>{`yarn add github:trevor00s/cadence#path:packages/sdk

# In your backend
import { createPublicClient, http } from 'viem'
import { arcTestnet, cadenceDeployments,
         hasActiveSubscription } from '@cadence/sdk'

const client = createPublicClient({ chain: arcTestnet, transport: http() })
const MANAGER = cadenceDeployments[arcTestnet.id]!.subscriptionManager

if (!await hasActiveSubscription(client, MANAGER, wallet, planId)) {
  return res.status(402).end()
}`}</Code>
          <p className="text-muted-foreground">
            See <a href="#paths" className="underline">Integration paths</a>{" "}
            for SDK embed and direct contract usage, or{" "}
            <a href="#migrate" className="underline">Migrate from Stripe</a> for
            a side-by-side mapping.
          </p>
        </Section>

        <Section id="what" title="What Cadence is">
          <p>
            Cadence is an open protocol for recurring USDC subscriptions on the
            Arc Network. It encodes the lifecycle of a subscription as three
            onchain actions: a merchant publishes a plan, a customer authorizes
            a Permit2 allowance, and a public keeper charges the subscription
            on schedule.
          </p>
          <p>
            There is no platform, no operator, and no privileged role beyond the
            merchant address that created a plan. A plan can only be
            deactivated by its merchant. A subscription can only be cancelled by
            its subscriber. Cadence holds no funds at any point.
          </p>
          <p>
            The contract is deployed at{" "}
            <code className="font-mono">{ARC_TESTNET.subscriptionManager}</code>
            . USDC is the only billing token in the current release.
          </p>
        </Section>

        <Section id="flow" title="The flow">
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <b>Merchant creates a plan.</b> They call{" "}
              <code className="font-mono">createPlan</code> with amount, period,
              and a keeper bounty in basis points.
            </li>
            <li>
              <b>Customer authorizes Permit2.</b> One ERC20 approval to Permit2
              (set max), then one EIP-712 signature over PermitSingle. The
              SubscriptionManager is the spender.
            </li>
            <li>
              <b>Contract pulls on schedule.</b> Anyone can call{" "}
              <code className="font-mono">charge(subId)</code> once{" "}
              <code className="font-mono">isDue</code> returns true. The caller
              receives the bounty in USDC from the payment.
            </li>
            <li>
              <b>Customer cancels.</b> The subscriber calls{" "}
              <code className="font-mono">cancel(subId)</code> any time. Future
              charges revert.
            </li>
          </ol>
        </Section>

        <Section id="permit2" title="Why Permit2 and not signMessage">
          <p>
            A raw <code className="font-mono">signMessage</code> is an off-chain
            attestation. It cannot constrain a token transfer on its own.
            Systems built on signMessage need a custodial actor that holds funds
            or pre-pulls a balance, otherwise the signature has no enforceable
            effect.
          </p>
          <p>
            Permit2 is different. The signature authorizes an onchain allowance
            inside Uniswap's audited{" "}
            <code className="font-mono">AllowanceTransfer</code> contract. Once
            signed, the SubscriptionManager can pull up to the authorized
            amount until the allowance expires or the subscriber cancels.
            Authorization is verifiable. No custody is required.
          </p>
        </Section>

        <Section id="bounty" title="Why a bounty model">
          <p>
            Renewals must be triggered. In a centralized stack this is a cron
            job operated by the platform. Cadence does not have a platform, so
            renewals are made permissionless: anyone can call{" "}
            <code className="font-mono">charge</code> when a subscription is
            due, and the caller earns a share of the charge as a bounty,
            denominated in USDC.
          </p>
          <p>
            Because gas on Arc is paid in USDC, keepers can be self-funding from
            the bounty itself. Merchants set the bounty when they create the
            plan. Higher bounty means faster execution at the cost of a smaller
            net payout per cycle.
          </p>
        </Section>

        <Section id="fee" title="Protocol fee">
          <p>
            A flat 0.5% (<code className="font-mono">PROTOCOL_FEE_BPS = 50</code>)
            is deducted from every charge and routed by the contract to an
            immutable treasury address set at deploy time. The constant cannot
            be modified, the recipient cannot be rotated, and there is no
            admin role with the power to do either.
          </p>
          <p>
            A 10 USDC charge with a 50 bps keeper bounty splits as:
          </p>
          <div className="overflow-x-auto rounded-md border border-rule mt-3">
            <table className="w-full text-[13.5px] tabular">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] font-600 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Recipient</th>
                  <th className="text-left px-4 py-2.5">Share</th>
                  <th className="text-left px-4 py-2.5">USDC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 font-600">Merchant</td>
                  <td className="px-4 py-3 text-muted-foreground">99.0%</td>
                  <td className="px-4 py-3">9.90</td>
                </tr>
                <tr className="border-t border-rule">
                  <td className="px-4 py-3 font-600">Keeper</td>
                  <td className="px-4 py-3 text-muted-foreground">0.5%</td>
                  <td className="px-4 py-3">0.05</td>
                </tr>
                <tr className="border-t border-rule">
                  <td className="px-4 py-3 font-600">Protocol fee</td>
                  <td className="px-4 py-3 text-muted-foreground">0.5%</td>
                  <td className="px-4 py-3">0.05</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="migrate" title="Migrate from Stripe Billing">
          <p>
            If you have an existing SaaS on Stripe Billing, here is the
            mapping. Every concept on the left has a Cadence counterpart.
          </p>
          <div className="overflow-x-auto rounded-md border border-rule mt-3">
            <table className="w-full text-[13.5px]">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] font-600 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Stripe</th>
                  <th className="text-left px-4 py-2.5">Cadence</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Product + Price", "Plan (amount, period, bountyBps)"],
                  ["Customer", "Subscriber wallet address"],
                  ["Payment method", "Permit2 allowance"],
                  ["customer.subscription.created", "Subscribed event"],
                  ["invoice.paid", "Charged event"],
                  ["customer.subscription.deleted", "Cancelled event"],
                  ["Webhook endpoint", "Indexer over the contract events"],
                  ["Billing portal", "/subscriptions route"],
                  ["Test mode keys", "Arc Testnet (this deployment)"],
                  ["Live mode keys", "Mainnet (post-audit)"],
                ].map((row, i) => (
                  <tr key={i} className={i > 0 ? "border-t border-rule" : ""}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row[0]}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12.5px]">
                      {row[1]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            Five steps to migrate
          </h3>
          <ol className="list-decimal pl-5 space-y-2.5">
            <li>
              Recreate each Stripe Price as a Cadence plan via the merchant
              console. Record planId per tier.
            </li>
            <li>
              Replace your Stripe Checkout redirect with{" "}
              <code className="font-mono">/subscribe?plan=&lt;planId&gt;</code>.
            </li>
            <li>
              Replace the Stripe webhook handler with a small indexer that
              listens for{" "}
              <code className="font-mono">Subscribed/Charged/Cancelled</code>{" "}
              events. See{" "}
              <a href="#indexer" className="underline">
                Database indexer
              </a>
              .
            </li>
            <li>
              Add SIWE wallet sign-in to your auth flow. Store
              walletAddress next to userId.
            </li>
            <li>
              Replace your entitlement check with{" "}
              <code className="font-mono">hasActiveSubscription</code>.
            </li>
          </ol>
        </Section>

        <Section id="reference" title="Contract reference">
          <div className="space-y-5">
            <FnRef
              sig="createPlan(address token, uint160 amount, uint48 period, uint16 bountyBps) returns (uint256 planId)"
              desc="Registers a plan owned by msg.sender. Returns the new plan ID."
            />
            <FnRef
              sig="deactivatePlan(uint256 planId)"
              desc="Marks a plan inactive. Future charges across all of its subscriptions will revert. Callable only by the plan merchant."
            />
            <FnRef
              sig="subscribe(uint256 planId, PermitSingle permitSingle, bytes signature) returns (uint256 subId)"
              desc="Installs the Permit2 allowance on behalf of msg.sender and pulls the first charge atomically. Returns the new subscription ID."
            />
            <FnRef
              sig="cancel(uint256 subId)"
              desc="Cancels the subscription. Callable only by the subscriber address that owns it."
            />
            <FnRef
              sig="charge(uint256 subId)"
              desc="Pulls the next due payment via Permit2.transferFrom. Pays the keeper bounty to msg.sender. Reverts if not due, plan inactive, or subscription cancelled."
            />
            <FnRef
              sig="isDue(uint256 subId) view returns (bool)"
              desc="Returns true when the subscription is ready for its next charge."
            />
          </div>
        </Section>

        <Section id="paths" title="Integration paths">
          <p>
            Three ways to wire Cadence into a SaaS. Pick by how much control you
            want over the customer flow.
          </p>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            Path 1. Hosted redirect (10 minutes)
          </h3>
          <p>
            Send the customer to the Cadence hosted checkout. Read on-chain
            whether they subscribed on return. Simplest possible integration.
          </p>
          <Code>{`const url = \`https://cadence.your-domain/subscribe?plan=\${planId}\`
res.redirect(url)`}</Code>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            Path 2. Embedded SDK
          </h3>
          <p>
            Install the SDK and drive Permit2 approval, signature, and the{" "}
            <code className="font-mono">subscribe</code> tx from your own React
            app. The customer never leaves your domain.
          </p>
          <Code>{`yarn add github:trevor00s/cadence#path:packages/sdk viem wagmi`}</Code>
          <p>
            See the full snippet under{" "}
            <a href="#reference" className="underline">
              Contract reference
            </a>{" "}
            and{" "}
            <a
              href="https://github.com/trevor00s/cadence/blob/main/INTEGRATION.md"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              INTEGRATION.md
            </a>
            .
          </p>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            Path 3. Direct contract calls
          </h3>
          <p>
            Skip the SDK and call the contract ABIs directly. Use this if you
            have strong reasons (gas optimisation, custom signing flow, account
            abstraction, passkey wallets). The ABI is published in the SDK
            source and on ArcScan.
          </p>
        </Section>

        <Section id="gating" title="Backend gating">
          <p>
            Your server needs one question answered: is wallet X currently
            entitled to plan Y? Two ways to answer it.
          </p>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            On-demand read
          </h3>
          <p>
            Read the contract from your backend (no key required, this is a
            view call). Cache the result for 30 to 60 seconds. This is enough
            for most apps.
          </p>
          <Code>{`import { createPublicClient, http } from 'viem'
import { arcTestnet, cadenceDeployments,
         hasActiveSubscription } from '@cadence/sdk'

const client = createPublicClient({
  chain: arcTestnet, transport: http(),
})
const MANAGER = cadenceDeployments[arcTestnet.id]!.subscriptionManager

export async function isEntitled(
  wallet: \`0x\${string}\`, planId: bigint,
) {
  return hasActiveSubscription(client, MANAGER, wallet, planId)
}`}</Code>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            Event-indexed mirror
          </h3>
          <p>
            For high traffic, build a tiny indexer. Listen for{" "}
            <code className="font-mono">Subscribed</code>,{" "}
            <code className="font-mono">Charged</code>,{" "}
            <code className="font-mono">Cancelled</code>, and{" "}
            <code className="font-mono">PlanDeactivated</code> events. Mirror
            state into your DB. Auth becomes a local read. A 5 block safety
            window is enough on Arc.
          </p>
        </Section>

        <Section id="wallet-binding" title="Tying a wallet to your user">
          <p>
            Use Sign-In With Ethereum (EIP-4361). The flow:
          </p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Server issues a nonce.</li>
            <li>
              Client signs a SIWE message including their wallet and your
              domain.
            </li>
            <li>
              Server verifies, stores{" "}
              <code className="font-mono">(userId, walletAddress)</code>.
            </li>
          </ol>
          <p>
            From that point, every authenticated request has a userId and a
            walletAddress. Feed the wallet into{" "}
            <code className="font-mono">isEntitled</code>.
          </p>
          <p className="text-muted-foreground">
            Do not use plain{" "}
            <code className="font-mono">signMessage</code> of an arbitrary
            string. SIWE guards against phishing and replay.
          </p>
        </Section>

        <Section id="lifecycle" title="Subscription lifecycle">
          <p>
            A subscription is in exactly one of five states. The SDK helper{" "}
            <code className="font-mono">getSubscriptionStatus</code> returns the
            state and an <code className="font-mono">isEntitled</code> bool.
          </p>
          <div className="overflow-x-auto rounded-md border border-rule mt-4">
            <table className="w-full text-[13.5px]">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] font-600 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">State</th>
                  <th className="text-left px-4 py-2.5">Meaning</th>
                  <th className="text-left px-4 py-2.5">What to do</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "active",
                    "Paid through the current period.",
                    "Grant access.",
                  ],
                  [
                    "due",
                    "Period elapsed, no charge yet.",
                    "Default: revoke until charge lands. Optional grace window.",
                  ],
                  [
                    "cancelled",
                    "Customer revoked.",
                    "Revoke access. Allow re-subscribing.",
                  ],
                  [
                    "plan_inactive",
                    "Merchant deactivated the plan.",
                    "Revoke access. Migrate user to a new plan.",
                  ],
                  [
                    "not_found",
                    "The subId does not exist.",
                    "Treat as no subscription.",
                  ],
                ].map(([s, m, w], i) => (
                  <tr
                    key={s}
                    className={i > 0 ? "border-t border-rule" : ""}
                  >
                    <td className="px-4 py-3 font-mono font-600">{s}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m}</td>
                    <td className="px-4 py-3">{w}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="keeper" title="Running a keeper">
          <p>
            If a subscription is due and nobody calls{" "}
            <code className="font-mono">charge()</code>, no money moves. Three
            options:
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <b>Run the reference keeper</b> in{" "}
              <code className="font-mono">keeper/</code>. Around 100 lines of
              Node. Polls every 30s. Deploy as a small VM or Cloudflare Worker
              cron.
            </li>
            <li>
              <b>Trust the open market</b>. Anyone can call{" "}
              <code className="font-mono">charge()</code> on a due subscription
              and earns the bounty. If you set a 50 bps bounty, independent
              operators have an incentive to fire. No SLA.
            </li>
            <li>
              <b>Both</b>. Run your own keeper as primary. Open market as
              fallback. Recommended for production.
            </li>
          </ol>
        </Section>

        <Section id="indexer" title="Database indexer">
          <p>
            For high traffic or for off-chain analytics, mirror contract events
            into your database. Below is a minimal Supabase / Postgres schema
            plus the event loop you point at it. Adapt to Neon, Planetscale,
            SQLite, or any Postgres-compatible store.
          </p>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            1. Schema
          </h3>
          <Code>{`create table cadence_subscriptions (
  sub_id            numeric primary key,
  plan_id           numeric not null,
  subscriber        text    not null,
  next_charge       timestamptz not null,
  status            text    not null default 'active',
  created_at        timestamptz not null default now(),
  last_charge_at    timestamptz
);
create index on cadence_subscriptions(subscriber);
create index on cadence_subscriptions(plan_id);

create table cadence_charges (
  tx_hash           text primary key,
  sub_id            numeric not null references cadence_subscriptions(sub_id),
  charged_at        timestamptz not null,
  amount_to_merchant numeric not null,
  protocol_fee      numeric not null,
  keeper_bounty     numeric not null,
  keeper            text
);`}</Code>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            2. Watcher (Node)
          </h3>
          <Code>{`import { createPublicClient, http, parseAbiItem } from 'viem'
import { arcTestnet, cadenceDeployments } from '@cadence/sdk'
import { pg } from './db'

const client = createPublicClient({ chain: arcTestnet, transport: http() })
const MANAGER = cadenceDeployments[arcTestnet.id]!.subscriptionManager

const subscribedAbi = parseAbiItem(
  'event Subscribed(uint256 indexed subId, uint256 indexed planId, address indexed subscriber)'
)
const chargedAbi = parseAbiItem(
  'event Charged(uint256 indexed subId, uint48 chargedAt, uint48 nextChargeAt, uint160 amountToMerchant, uint160 bountyToKeeper, uint160 protocolFee, address keeper)'
)
const cancelledAbi = parseAbiItem(
  'event Cancelled(uint256 indexed subId, address by)'
)

client.watchEvent({
  address: MANAGER, event: subscribedAbi,
  onLogs: async (logs) => { for (const l of logs) await pg.upsertSub(l.args) },
})
client.watchEvent({
  address: MANAGER, event: chargedAbi,
  onLogs: async (logs) => { for (const l of logs) await pg.recordCharge(l) },
})
client.watchEvent({
  address: MANAGER, event: cancelledAbi,
  onLogs: async (logs) => {
    for (const l of logs) await pg.markCancelled(l.args.subId)
  },
})`}</Code>
          <p className="text-muted-foreground">
            Reorgs on Arc are short. A 5 block safety window before treating an
            event as final is enough for production.
          </p>
        </Section>

        <Section id="troubleshooting" title="Troubleshooting">
          <h3 className="mt-2 text-[17px] font-700 tracking-tight">
            Subscribe transaction reverts with NotDue
          </h3>
          <p>
            <code className="font-mono">subscribe</code> never throws
            NotDue. If your tx is reverting with that error, you are calling{" "}
            <code className="font-mono">charge</code> on a subscription whose{" "}
            <code className="font-mono">nextCharge</code> is in the future.
            Read{" "}
            <code className="font-mono">isDue(subId)</code> first.
          </p>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            Charge reverts with insufficient allowance
          </h3>
          <p>
            The subscriber signed a Permit2 PermitSingle with an{" "}
            <code className="font-mono">amount</code> too low to cover the next
            charge, or the allowance{" "}
            <code className="font-mono">expiration</code> has passed. Both are
            recovered by having the subscriber sign a fresh PermitSingle and
            calling subscribe again (or by calling{" "}
            <code className="font-mono">Permit2.permit</code> directly with the
            new sig). Cancel the old sub first if you do not want a duplicate.
          </p>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            Charge reverts with insufficient balance
          </h3>
          <p>
            The subscriber's USDC wallet is empty. The keeper should back off
            and retry. The reference keeper waits 10 minutes between retries
            for a given sub. Your SaaS should mark the user as lapsed.
          </p>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            Permit2 signature fails in MetaMask
          </h3>
          <p>
            MetaMask sometimes refuses to sign typed data if the domain
            verifyingContract is on a chain the wallet has not been told about.
            Make sure your wagmi config has Arc Testnet defined and that
            RainbowKit's <code className="font-mono">initialChain</code> points
            to it. The Cadence SDK exports{" "}
            <code className="font-mono">arcTestnet</code> for this.
          </p>

          <h3 className="mt-6 text-[17px] font-700 tracking-tight">
            Indexer is missing events
          </h3>
          <p>
            Use a single RPC for the watcher to avoid divergence between
            providers. After a restart, replay from the last block you
            processed, not from "latest". Save the block number you have
            confirmed.
          </p>
        </Section>

        <Section id="pricing" title="Plan pricing">
          <p>Three knobs on createPlan.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <b>amount</b> (uint160, token base units). 10 USDC at 6 decimals
              is <code className="font-mono">10_000_000n</code>.
            </li>
            <li>
              <b>period</b> (uint48 seconds). 30 days is{" "}
              <code className="font-mono">2_592_000</code>. Minimum enforced by
              the contract is 1 hour.
            </li>
            <li>
              <b>bountyBps</b> (uint16, max 1000). 50 bps (0.5%) is a sensible
              default. Higher means faster open-market execution. 0 means only
              your own keeper or a charitable third party fires it.
            </li>
          </ul>
        </Section>

        <Section id="not-included" title="What this protocol does not do">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <b>Refunds.</b> No on-chain refund function. If you owe a
              customer, send USDC back from your wallet out of band.
            </li>
            <li>
              <b>Proration.</b> Charges are full-amount, full-period. Cancel
              the old sub and start a new one if you change tiers.
            </li>
            <li>
              <b>Trials.</b> No protocol-level free period. Implement in your
              app: grant access without a sub during the trial, then redirect
              to subscribe.
            </li>
            <li>
              <b>Tax invoices.</b> The on-chain transactions are your
              receipts. Render PDFs yourself from your indexer mirror if
              needed.
            </li>
            <li>
              <b>Chargebacks / KYC.</b> If you need either, you need a
              different stack (or layer it on top of Cadence).
            </li>
          </ul>
        </Section>

        <Section id="checklist" title="Production checklist">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Plan amounts denominated in token base units. Read{" "}
              <code className="font-mono">plans(planId)</code> after creation
              to sanity-check.
            </li>
            <li>
              Cache <code className="font-mono">isEntitled</code> reads for 30
              to 60 seconds. Do not hammer your RPC per request.
            </li>
            <li>
              Clear UI states for subscribe and cancel: approving, signing,
              broadcasting, confirmed. Wallet UX is unforgiving.
            </li>
            <li>
              Fallback RPC URL. Cadence depends on no central infra except
              your chosen RPC.
            </li>
            <li>
              Mainnet is currently not supported. Wait for an audit.
            </li>
          </ul>
        </Section>

        <Section id="changelog" title="Changelog">
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-[color:var(--accent-ink)]">
                  v0.2.0
                </span>
                <span className="text-[12px] text-muted-foreground">
                  2026 May 21
                </span>
              </div>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-[14px]">
                <li>
                  Added a flat 0.5% protocol fee, routed by the contract to an
                  immutable treasury address.
                </li>
                <li>
                  Charged event now carries the protocol fee amount in
                  addition to the keeper bounty.
                </li>
                <li>
                  Redeployed manager to{" "}
                  <code className="font-mono">
                    {ARC_TESTNET.subscriptionManager}
                  </code>
                  . The previous deployment is abandoned.
                </li>
                <li>
                  Docs reorganised around quick start, migration from Stripe,
                  indexer template, and troubleshooting.
                </li>
              </ul>
            </div>

            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-[color:var(--accent-ink)]">
                  v0.1.0
                </span>
                <span className="text-[12px] text-muted-foreground">
                  2026 May 20
                </span>
              </div>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-[14px]">
                <li>
                  Initial protocol: plans, subscribe with Permit2, charge with
                  permissionless keeper bounty, cancel.
                </li>
                <li>
                  SDK published from GitHub. Reference keeper bot. Vite +
                  TanStack Start frontend.
                </li>
                <li>First deployment to Arc Testnet.</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section id="audit" title="Audit status">
          <div className="border border-[color:var(--accent-ink)] rounded-md p-4 bg-[color:var(--accent-ink)]/8">
            <div className="text-[11px] uppercase tracking-[0.08em] font-700 text-[color:var(--accent-ink)] mb-1">
              Pre-production
            </div>
            <div className="text-[14px]">
              The Cadence contracts are unaudited. Use on Arc Testnet only. Do
              not use with funds you cannot afford to lose.
            </div>
          </div>
        </Section>
      </article>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="text-[24px] font-700 tracking-tight">{title}</h2>
      <div className="mt-3 text-[15px] leading-[1.7] text-foreground/85 space-y-3">
        {children}
      </div>
    </section>
  );
}

function FnRef({ sig, desc }: { sig: string; desc: string }) {
  return (
    <div className="border-l-2 border-rule pl-4">
      <div className="font-mono text-[13px] break-words">{sig}</div>
      <div className="mt-1 text-[14px] text-muted-foreground">{desc}</div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-md border border-rule bg-card p-4 font-mono text-[12.5px] leading-[1.6]">
      <code>{children}</code>
    </pre>
  );
}

const integrationCode = `import { createPublicClient, http } from 'viem'
import { arcTestnet, subscriptionManagerAbi, ARC_TESTNET } from './chain'

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
})

// 1. Read a plan
const plan = await publicClient.readContract({
  address: ARC_TESTNET.subscriptionManager,
  abi: subscriptionManagerAbi,
  functionName: 'plans',
  args: [planId],
})

// 2. Build a Permit2 PermitSingle and sign it
const nonce = (await publicClient.readContract({
  address: ARC_TESTNET.permit2,
  abi: permit2Abi,
  functionName: 'allowance',
  args: [owner, plan[1], ARC_TESTNET.subscriptionManager],
}))[2]

const permitSingle = {
  details: {
    token: plan[1],
    amount: (1n << 160n) - 1n,
    expiration: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10,
    nonce,
  },
  spender: ARC_TESTNET.subscriptionManager,
  sigDeadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
}

const signature = await walletClient.signTypedData({
  domain: { name: 'Permit2', chainId: 5042002, verifyingContract: ARC_TESTNET.permit2 },
  types: PERMIT2_TYPES,
  primaryType: 'PermitSingle',
  message: permitSingle,
})

// 3. Subscribe (first charge in the same tx)
const hash = await walletClient.writeContract({
  address: ARC_TESTNET.subscriptionManager,
  abi: subscriptionManagerAbi,
  functionName: 'subscribe',
  args: [planId, permitSingle, signature],
})`;
