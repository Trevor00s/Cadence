import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { ARC_TESTNET, subscriptionManagerAbi } from "@/lib/cadence/chain";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cadence. Recurring USDC subscriptions on Arc." },
      {
        name: "description",
        content:
          "Open protocol for recurring USDC subscriptions on Arc. One Permit2 signature. No custody, no API keys.",
      },
    ],
  }),
  component: Landing,
});

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-muted/50 px-2.5 py-1 text-[11px] font-600 uppercase tracking-[0.08em] text-muted-foreground">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--accent-ink)]" />
      {children}
    </span>
  );
}

function LiveState() {
  const publicClient = usePublicClient();
  const [counts, setCounts] = useState<{ plans: bigint; subs: bigint } | null>(
    null,
  );

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    (async () => {
      try {
        const [plans, subs] = await Promise.all([
          publicClient.readContract({
            address: ARC_TESTNET.subscriptionManager,
            abi: subscriptionManagerAbi,
            functionName: "nextPlanId",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: ARC_TESTNET.subscriptionManager,
            abi: subscriptionManagerAbi,
            functionName: "nextSubId",
          }) as Promise<bigint>,
        ]);
        if (!cancelled) setCounts({ plans, subs });
      } catch {
        if (!cancelled) setCounts(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  return (
    <div className="mt-8 inline-flex items-center gap-4 rounded-md border border-rule bg-card px-4 py-2.5 text-[12px] font-mono text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--accent-ink)]" />
        live on arc testnet
      </span>
      <span className="text-rule">|</span>
      <span>
        <span className="text-foreground tabular">
          {counts ? counts.plans.toString() : "."}
        </span>{" "}
        plans
      </span>
      <span className="text-rule">|</span>
      <span>
        <span className="text-foreground tabular">
          {counts ? counts.subs.toString() : "."}
        </span>{" "}
        subscriptions
      </span>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-rule bg-card p-5 text-[13px] leading-[1.6] font-mono">
      {children}
    </pre>
  );
}

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group border-b border-rule py-5 [&_summary]:cursor-pointer">
      <summary className="flex items-center justify-between gap-6 text-[16px] font-600 list-none">
        <span>{q}</span>
        <span className="text-[color:var(--accent-ink)] font-mono text-[18px] transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 text-[14.5px] text-muted-foreground leading-relaxed max-w-[64ch]">
        {a}
      </div>
    </details>
  );
}

function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-20">
        <div className="max-w-[760px]">
          <Pill>Arc Testnet, chain 5042002</Pill>
          <h1 className="mt-5 text-[44px] sm:text-[60px] leading-[1.02] tracking-[-0.025em] font-800">
            Recurring USDC subscriptions on Arc.
          </h1>
          <p className="mt-5 text-[17px] leading-[1.55] text-muted-foreground">
            One Permit2 signature from your customer. A public contract pulls
            payment on cadence. No custody, no API keys, no merchant
            onboarding. Cancellable in one transaction.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/merchant"
              className="rounded-md bg-primary px-4 py-2.5 text-[14px] font-600 text-primary-foreground hover:opacity-90"
            >
              For merchants
            </Link>
            <Link
              to="/subscribe"
              className="rounded-md border border-foreground px-4 py-2.5 text-[14px] font-600 hover:bg-muted"
            >
              For customers
            </Link>
            <Link
              to="/docs"
              className="rounded-md px-4 py-2.5 text-[14px] font-600 text-muted-foreground hover:text-foreground"
            >
              Read the docs →
            </Link>
          </div>
          <LiveState />
          <div className="mt-6 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="font-mono">manager</span>
            <a
              href={`${ARC_TESTNET.explorer}/address/${ARC_TESTNET.subscriptionManager}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:text-[color:var(--accent-ink)] break-all"
            >
              {ARC_TESTNET.subscriptionManager}
            </a>
          </div>
        </div>
      </section>

      {/* Primitive row */}
      <section className="hairline-b hairline">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid md:grid-cols-3">
          {[
            {
              n: "01",
              h: "Customer signs once",
              p: "EIP-712 typed data over Uniswap's Permit2 AllowanceTransfer. The allowance lives onchain.",
            },
            {
              n: "02",
              h: "Contract pulls on schedule",
              p: "Permissionless keepers call charge() and earn a bounty in USDC. Renewals are self funding.",
            },
            {
              n: "03",
              h: "Cancel any time onchain",
              p: "The subscriber sends one transaction to cancel. No support ticket, no intermediary.",
            },
          ].map((c, i) => (
            <div
              key={c.n}
              className={
                "py-10 md:py-12 px-0 md:px-8 " +
                (i > 0 ? "md:border-l border-rule" : "")
              }
            >
              <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
                {c.n}
              </div>
              <h3 className="mt-2 text-[18px] font-700 tracking-tight">
                {c.h}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                {c.p}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* For developers */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
        <div className="grid md:grid-cols-[1fr_1.4fr] gap-10">
          <div>
            <Pill>For developers</Pill>
            <h2 className="mt-4 text-[32px] leading-tight tracking-[-0.02em] font-700">
              Five minutes from `yarn add` to a gated SaaS.
            </h2>
            <p className="mt-4 text-[14.5px] text-muted-foreground leading-relaxed">
              The SDK is published from GitHub, not the npm registry. Read the
              integration guide for the full flow. The snippet on the right is
              the entire backend gate.
            </p>
            <div className="mt-6 flex gap-3">
              <Link
                to="/docs"
                className="rounded-md bg-primary px-4 py-2.5 text-[14px] font-600 text-primary-foreground hover:opacity-90"
              >
                Read integration guide
              </Link>
              <a
                href="https://github.com/trevor00s/cadence"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-foreground px-4 py-2.5 text-[14px] font-600 hover:bg-muted"
              >
                GitHub
              </a>
            </div>
          </div>
          <CodeBlock>
            <span className="text-muted-foreground">
              {`// 1. install\n`}
            </span>
            <span>{`yarn add github:trevor00s/cadence#path:packages/sdk`}</span>
            {`\n\n`}
            <span className="text-muted-foreground">
              {`// 2. gate your SaaS in one call\n`}
            </span>
            <span>{`import { createPublicClient, http } from 'viem'`}</span>
            {`\n`}
            <span>
              {`import { arcTestnet, cadenceDeployments,`}
            </span>
            {`\n`}
            <span>
              {`  hasActiveSubscription } from '@cadence/sdk'`}
            </span>
            {`\n\n`}
            <span>
              {`const client = createPublicClient({`}
            </span>
            {`\n`}
            <span>{`  chain: arcTestnet, transport: http() })`}</span>
            {`\n\n`}
            <span>{`const MANAGER = cadenceDeployments[arcTestnet.id]`}</span>
            {`\n`}
            <span>{`  !.subscriptionManager`}</span>
            {`\n\n`}
            <span>
              {`export async function isEntitled(`}
            </span>
            {`\n`}
            <span>{`  wallet: \`0x\${string}\`, planId: bigint,`}</span>
            {`\n`}
            <span>{`) {`}</span>
            {`\n`}
            <span>{`  return hasActiveSubscription(`}</span>
            {`\n`}
            <span>{`    client, MANAGER, wallet, planId)`}</span>
            {`\n`}
            <span>{`}`}</span>
          </CodeBlock>
        </div>
      </section>

      {/* Comparison table */}
      <section className="hairline-b hairline">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid md:grid-cols-[1fr_2fr] gap-10">
          <div>
            <Pill>Compare</Pill>
            <h2 className="mt-4 text-[32px] leading-tight tracking-[-0.02em] font-700">
              Off-chain authorization is a promise. Permit2 is a primitive.
            </h2>
            <p className="mt-4 text-[14px] text-muted-foreground leading-relaxed">
              Cadence is built on the same allowance contract used across
              Uniswap and most major DEXes. There is no off-chain ledger to
              trust.
            </p>
          </div>
          <div className="border border-rule rounded-md overflow-hidden bg-card">
            <div className="grid grid-cols-[1.2fr_1.4fr_1.4fr] text-[11px] font-600 uppercase tracking-[0.08em] text-muted-foreground bg-muted/50 border-b border-rule">
              <div className="px-4 py-3"> </div>
              <div className="px-4 py-3">Off-chain auth gateway</div>
              <div className="px-4 py-3 text-[color:var(--accent-ink)]">
                Cadence
              </div>
            </div>
            {[
              [
                "Authorization",
                "Custodial or off-chain promise",
                "Permit2 AllowanceTransfer onchain",
              ],
              [
                "API keys",
                "Required",
                "None. Your wallet is your identity",
              ],
              [
                "Merchant onboarding",
                "KYC, badges, approvals",
                "Permissionless. Anyone creates a plan",
              ],
              [
                "Renewal trigger",
                "Centralized cron",
                "Permissionless keepers earn a bounty",
              ],
              [
                "Cancellation",
                "Email support, dashboard click",
                "One transaction, no intermediary",
              ],
              [
                "Fees",
                "2.9% + $0.30 per charge",
                "0.5% protocol fee. Onchain, transparent",
              ],
            ].map((row, i) => (
              <div
                key={i}
                className={
                  "grid grid-cols-[1.2fr_1.4fr_1.4fr] text-[13.5px] " +
                  (i > 0 ? "border-t border-rule" : "")
                }
              >
                <div className="px-4 py-4 font-600">{row[0]}</div>
                <div className="px-4 py-4 text-muted-foreground">{row[1]}</div>
                <div className="px-4 py-4">{row[2]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
        <div className="grid md:grid-cols-[1fr_2fr] gap-10">
          <div>
            <Pill>Cost</Pill>
            <h2 className="mt-4 text-[32px] leading-tight tracking-[-0.02em] font-700">
              0.5% flat. Nothing else.
            </h2>
            <p className="mt-4 text-[14px] text-muted-foreground leading-relaxed">
              Stripe takes 2.9% plus thirty cents per charge. Cadence takes
              0.5%, paid in USDC, routed by the contract to an immutable
              treasury address. Every fee is verifiable onchain.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                k: "Protocol fee",
                v: "0.5%",
                d: "Of every charge. Routed by the contract to an immutable treasury. Set at deploy time, can never increase.",
              },
              {
                k: "Network gas",
                v: "≈ $0.001",
                d: "Per transaction, paid in USDC on Arc. Renewals are self funded by the keeper bounty.",
              },
              {
                k: "Keeper bounty",
                v: "0 to 10%",
                d: "Set by the merchant per plan. 0.5% is a sensible default.",
              },
            ].map((c) => (
              <div
                key={c.k}
                className="border border-rule rounded-md bg-card p-5"
              >
                <div className="text-[11px] font-600 uppercase tracking-[0.08em] text-muted-foreground">
                  {c.k}
                </div>
                <div className="mt-2 text-[28px] font-700 tabular tracking-tight">
                  {c.v}
                </div>
                <div className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                  {c.d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="hairline-b hairline">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid md:grid-cols-[1fr_2fr] gap-10">
          <div>
            <Pill>FAQ</Pill>
            <h2 className="mt-4 text-[32px] leading-tight tracking-[-0.02em] font-700">
              Common questions.
            </h2>
            <p className="mt-4 text-[14px] text-muted-foreground leading-relaxed">
              If something is missing, check the docs or open an issue on
              GitHub.
            </p>
          </div>
          <div>
            <FaqItem
              q="Is this audited? Can I use it in production?"
              a="No. The contract is unaudited and only deployed to Arc testnet. Use real funds at your own risk. An audit is on the roadmap before mainnet."
            />
            <FaqItem
              q="How is this different from Stripe Billing?"
              a={
                <>
                  Stripe is custodial. Stripe holds your money, can freeze your
                  account, and acts as the contract between you and your
                  customer. Cadence is a public contract. Payments go wallet to
                  wallet. The protocol cannot take, freeze, or reroute funds.
                  You also give up everything Stripe gives you: chargebacks,
                  KYC, fiat off-ramp, tax invoices. Different tool, different
                  trade-offs.
                </>
              }
            />
            <FaqItem
              q="What happens if my customer cancels?"
              a="The next call to charge(subId) reverts. No further USDC moves from their wallet. Past charges are not refunded by the protocol. If you owe a refund, send it from your wallet directly."
            />
            <FaqItem
              q="What happens if my customer runs out of USDC?"
              a="The charge transaction reverts. The subscription stays open and any keeper can retry. The reference keeper backs off ten minutes between retries for a given sub. Your SaaS should treat the subscription as lapsed and revoke access until charge() lands."
            />
            <FaqItem
              q="Do I have to run a keeper?"
              a={
                <>
                  Strictly no. Anyone can call charge() on a due subscription
                  and earn the bounty. In practice you should run one yourself
                  for reliability. The reference keeper in the repo is around
                  100 lines of Node. Deploy it as a small VM or Cloudflare
                  Worker cron.
                </>
              }
            />
            <FaqItem
              q="How does Cadence make money?"
              a={
                <>
                  A 0.5% protocol fee is taken from every charge and routed by
                  the contract to an immutable treasury address. The fee rate
                  is a constant, not storage: it cannot be raised after deploy.
                  There is no per-transaction surcharge, no monthly minimum,
                  no platform contract that can be upgraded to take more.
                </>
              }
            />
            <FaqItem
              q="Can I support tokens other than USDC?"
              a="The contract accepts any ERC20 the merchant points the plan at. On Arc, USDC is the natural choice because gas is paid in USDC, so renewals settle in the same currency. EURC is also live on Arc testnet."
            />
            <FaqItem
              q="What about mainnet?"
              a="Pre-production. Mainnet deployment requires an audit and a verified merchant address. Today, only Arc testnet is supported. Mainnet will follow once the contract is audited."
            />
          </div>
        </div>
      </section>

      {/* Built for */}
      <section className="hairline">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 flex flex-wrap items-baseline gap-x-8 gap-y-3">
          <span className="text-[11px] font-600 uppercase tracking-[0.08em] text-muted-foreground">
            Built for
          </span>
          {[
            "DAO treasuries",
            "OSS maintainers",
            "SaaS APIs",
            "Infrastructure providers",
            "Agent wallets",
          ].map((t) => (
            <span key={t} className="text-[15px] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
        <div className="grid md:grid-cols-2 gap-6">
          <Link
            to="/merchant"
            className="group border border-rule rounded-md p-8 bg-card hover:border-foreground transition-colors"
          >
            <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
              merchant
            </div>
            <h3 className="mt-2 text-[24px] font-700 tracking-tight">
              Create a plan in 30 seconds.
            </h3>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Amount, period, keeper bounty. Get a shareable checkout link.
            </p>
            <div className="mt-4 text-[13px] font-600">
              Open merchant console →
            </div>
          </Link>
          <Link
            to="/subscribe"
            className="group border border-rule rounded-md p-8 bg-card hover:border-foreground transition-colors"
          >
            <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
              subscriber
            </div>
            <h3 className="mt-2 text-[24px] font-700 tracking-tight">
              Subscribe with one signature.
            </h3>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Read the plan, sign Permit2, you are set. Cancel any time.
            </p>
            <div className="mt-4 text-[13px] font-600">Open checkout →</div>
          </Link>
        </div>
      </section>
    </div>
  );
}
