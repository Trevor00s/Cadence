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

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

interface LiveData {
  plans: bigint;
  subs: bigint;
  feesCollected: bigint;
}

function LiveState() {
  const publicClient = usePublicClient();
  const [data, setData] = useState<LiveData | null>(null);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    (async () => {
      try {
        const [plans, subs, feesCollected] = await Promise.all([
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
          publicClient.readContract({
            address: ARC_TESTNET.usdc,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [ARC_TESTNET.protocolFeeRecipient],
          }) as Promise<bigint>,
        ]);
        if (!cancelled) setData({ plans, subs, feesCollected });
      } catch {
        if (!cancelled) setData(null);
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
          {data ? data.plans.toString() : "."}
        </span>{" "}
        plans
      </span>
      <span className="text-rule">|</span>
      <span>
        <span className="text-foreground tabular">
          {data ? data.subs.toString() : "."}
        </span>{" "}
        subs
      </span>
    </div>
  );
}

function MetricsBoard() {
  const publicClient = usePublicClient();
  const [data, setData] = useState<LiveData | null>(null);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [plans, subs, feesCollected] = await Promise.all([
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
          publicClient.readContract({
            address: ARC_TESTNET.usdc,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [ARC_TESTNET.protocolFeeRecipient],
          }) as Promise<bigint>,
        ]);
        if (!cancelled) setData({ plans, subs, feesCollected });
      } catch {
        if (!cancelled) setData(null);
      }
    };
    void load();
    const id = setInterval(load, 12_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [publicClient]);

  const usdcFromBig = (v: bigint) => {
    const n = Number(v) / 1_000_000;
    return n < 1
      ? n.toFixed(2)
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };
  // Total settled volume can be inferred from fees / 0.005 since fee is 50bps.
  const totalSettled = data
    ? usdcFromBig((data.feesCollected * 10_000n) / 50n)
    : null;

  const metrics = [
    { k: "Plans created", v: data ? data.plans.toString() : "." },
    { k: "Subscriptions", v: data ? data.subs.toString() : "." },
    {
      k: "Total settled",
      v: totalSettled ? totalSettled + " USDC" : ".",
    },
    {
      k: "Protocol fees",
      v: data ? usdcFromBig(data.feesCollected) + " USDC" : ".",
    },
  ];

  return (
    <section className="hairline-b">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex items-baseline justify-between mb-6">
          <div className="text-[11px] font-600 uppercase tracking-[0.08em] text-muted-foreground">
            Live on Arc Testnet
          </div>
          <a
            href={`${ARC_TESTNET.explorer}/address/${ARC_TESTNET.subscriptionManager}`}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-mono text-muted-foreground hover:text-[color:var(--accent-ink)]"
          >
            view contract →
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4">
          {metrics.map((m, i) => (
            <div
              key={m.k}
              className={
                "py-4 px-0 md:px-6 " +
                (i > 0 ? "md:border-l border-rule" : "")
              }
            >
              <div className="text-[11px] font-600 uppercase tracking-[0.08em] text-muted-foreground">
                {m.k}
              </div>
              <div className="mt-2 text-[28px] font-700 tracking-[-0.02em] tabular">
                {m.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReceiptCard() {
  return (
    <div
      className="relative bg-card border border-rule rounded-md p-7 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_30px_rgba(0,0,0,0.04)]"
      style={{ fontFeatureSettings: '"tnum"' }}
    >
      {/* Top label row */}
      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span className="uppercase tracking-[0.08em] font-600">
          subscription · sub_0009
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--accent-ink)]" />
          active
        </span>
      </div>

      {/* Plan summary */}
      <div className="mt-5">
        <div className="text-[12px] font-mono text-muted-foreground">
          Acme Pro Tier
        </div>
        <div className="mt-1 flex items-baseline gap-2 tabular">
          <span className="text-[34px] font-700 tracking-[-0.02em]">10.00</span>
          <span className="text-[14px] text-muted-foreground">USDC</span>
          <span className="text-[13px] text-muted-foreground">
            every 30 days
          </span>
        </div>
      </div>

      <div className="hairline mt-6 mb-5" />

      {/* Lifecycle entries */}
      <div className="space-y-5">
        <ReceiptStep
          state="done"
          n="01"
          title="Permit2 authorized"
          desc="One EIP-712 signature. Allowance lives onchain."
          right="tx · 0x4f...91c"
        />
        <ReceiptStep
          state="done"
          n="02"
          title="Charged · 10.00 USDC"
          desc={
            <span className="tabular">
              merchant <b className="text-foreground">9.90</b>
              {" · "}keeper <b className="text-foreground">0.05</b>
              {" · "}fee <b className="text-foreground">0.05</b>
            </span>
          }
          right="block · 18,402"
        />
        <ReceiptStep
          state="pending"
          n="03"
          title="Next charge in 28 days"
          desc="Permissionless keeper will trigger when due."
          right="anyone can call"
        />
      </div>

      <div className="hairline mt-6 mb-4" />

      {/* Footer */}
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>Cancellable any time onchain.</span>
        <span className="font-mono">cancel()</span>
      </div>

      {/* Corner perforation effect (decorative) */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-2 left-6 right-6 h-2"
        style={{
          backgroundImage:
            "radial-gradient(circle at 6px 0, var(--background) 3px, transparent 4px)",
          backgroundSize: "12px 100%",
          backgroundRepeat: "repeat-x",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-2 left-6 right-6 h-2"
        style={{
          backgroundImage:
            "radial-gradient(circle at 6px 8px, var(--background) 3px, transparent 4px)",
          backgroundSize: "12px 100%",
          backgroundRepeat: "repeat-x",
        }}
      />
    </div>
  );
}

function ReceiptStep({
  state,
  n,
  title,
  desc,
  right,
}: {
  state: "done" | "pending";
  n: string;
  title: string;
  desc: React.ReactNode;
  right?: string;
}) {
  return (
    <div className="grid grid-cols-[20px_1fr] gap-3">
      <div className="pt-0.5">
        {state === "done" ? (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--accent-ink)] text-[10px] font-700 text-[var(--paper)]">
            ✓
          </span>
        ) : (
          <span className="inline-block h-4 w-4 rounded-full border border-foreground/40" />
        )}
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[10px] text-muted-foreground">
              {n}
            </span>
            <span className="text-[14px] font-600">{title}</span>
          </div>
          {right && (
            <span className="font-mono text-[10.5px] text-muted-foreground whitespace-nowrap">
              {right}
            </span>
          )}
        </div>
        <div className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
          {desc}
        </div>
      </div>
    </div>
  );
}

function FlowDiagram() {
  return (
    <section className="hairline-b hairline">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid md:grid-cols-[1fr_2fr] gap-10">
        <div>
          <Pill>Architecture</Pill>
          <h2 className="mt-4 text-[32px] leading-tight tracking-[-0.02em] font-700">
            One signature. Four ledger entries.
          </h2>
          <p className="mt-4 text-[14px] text-muted-foreground leading-relaxed">
            Each charge is a single Permit2 transferFrom that splits into three
            payments at the contract level. No off-chain routing, no batching
            risk.
          </p>
        </div>
        <div className="border border-rule rounded-md bg-card p-6 md:p-10">
          <svg
            viewBox="0 0 720 340"
            className="w-full h-auto"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
              </marker>
              <marker
                id="arrowAccent"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path
                  d="M0,0 L10,5 L0,10 z"
                  fill="var(--accent-ink)"
                />
              </marker>
            </defs>

            {/* Customer Wallet box */}
            <g>
              <rect
                x="20"
                y="20"
                width="160"
                height="70"
                rx="4"
                fill="var(--background)"
                stroke="currentColor"
                strokeWidth="1"
              />
              <text x="100" y="48" textAnchor="middle" fontSize="11" fill="var(--accent-ink)">
                01
              </text>
              <text
                x="100"
                y="72"
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="currentColor"
              >
                customer wallet
              </text>
            </g>

            {/* Permit2 box */}
            <g>
              <rect
                x="280"
                y="20"
                width="160"
                height="70"
                rx="4"
                fill="var(--background)"
                stroke="currentColor"
                strokeWidth="1"
              />
              <text x="360" y="48" textAnchor="middle" fontSize="11" fill="var(--accent-ink)">
                02
              </text>
              <text
                x="360"
                y="72"
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="currentColor"
              >
                permit2
              </text>
            </g>

            {/* SubscriptionManager box */}
            <g>
              <rect
                x="540"
                y="20"
                width="160"
                height="70"
                rx="4"
                fill="var(--background)"
                stroke="var(--accent-ink)"
                strokeWidth="1.5"
              />
              <text x="620" y="48" textAnchor="middle" fontSize="11" fill="var(--accent-ink)">
                03
              </text>
              <text
                x="620"
                y="72"
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="currentColor"
              >
                cadence manager
              </text>
            </g>

            {/* Arrows top row */}
            <line
              x1="180"
              y1="55"
              x2="280"
              y2="55"
              stroke="currentColor"
              strokeWidth="1"
              markerEnd="url(#arrow)"
            />
            <text x="230" y="48" textAnchor="middle" fontSize="10" fill="currentColor">
              sign
            </text>
            <line
              x1="440"
              y1="55"
              x2="540"
              y2="55"
              stroke="currentColor"
              strokeWidth="1"
              markerEnd="url(#arrow)"
            />
            <text x="490" y="48" textAnchor="middle" fontSize="10" fill="currentColor">
              allowance
            </text>

            {/* Down arrow from manager */}
            <line
              x1="620"
              y1="90"
              x2="620"
              y2="160"
              stroke="var(--accent-ink)"
              strokeWidth="1.5"
              markerEnd="url(#arrowAccent)"
            />
            <text x="635" y="130" fontSize="10" fill="var(--accent-ink)">
              charge()
            </text>

            {/* Split point */}
            <circle cx="620" cy="170" r="3" fill="var(--accent-ink)" />

            {/* Three split lines */}
            <line
              x1="620"
              y1="170"
              x2="160"
              y2="270"
              stroke="var(--accent-ink)"
              strokeWidth="1"
              markerEnd="url(#arrowAccent)"
            />
            <line
              x1="620"
              y1="170"
              x2="360"
              y2="270"
              stroke="var(--accent-ink)"
              strokeWidth="1"
              markerEnd="url(#arrowAccent)"
            />
            <line
              x1="620"
              y1="170"
              x2="620"
              y2="270"
              stroke="var(--accent-ink)"
              strokeWidth="1"
              markerEnd="url(#arrowAccent)"
            />

            {/* Bottom row: merchant, keeper, fee recipient */}
            <g>
              <rect
                x="80"
                y="270"
                width="160"
                height="60"
                rx="4"
                fill="var(--background)"
                stroke="currentColor"
                strokeWidth="1"
              />
              <text
                x="160"
                y="295"
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="currentColor"
              >
                merchant
              </text>
              <text
                x="160"
                y="313"
                textAnchor="middle"
                fontSize="10"
                fill="var(--accent-ink)"
              >
                99.0%
              </text>
            </g>

            <g>
              <rect
                x="280"
                y="270"
                width="160"
                height="60"
                rx="4"
                fill="var(--background)"
                stroke="currentColor"
                strokeWidth="1"
              />
              <text
                x="360"
                y="295"
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="currentColor"
              >
                keeper bounty
              </text>
              <text
                x="360"
                y="313"
                textAnchor="middle"
                fontSize="10"
                fill="var(--accent-ink)"
              >
                0.5%
              </text>
            </g>

            <g>
              <rect
                x="540"
                y="270"
                width="160"
                height="60"
                rx="4"
                fill="var(--background)"
                stroke="currentColor"
                strokeWidth="1"
              />
              <text
                x="620"
                y="295"
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="currentColor"
              >
                protocol fee
              </text>
              <text
                x="620"
                y="313"
                textAnchor="middle"
                fontSize="10"
                fill="var(--accent-ink)"
              >
                0.5%
              </text>
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}

function BuiltOn() {
  const items = [
    {
      k: "Permit2",
      v: "AllowanceTransfer",
      d: "Uniswap's canonical universal token approval contract. Battle tested across the largest DEX in the world.",
    },
    {
      k: "OpenZeppelin",
      v: "v5",
      d: "ReentrancyGuard, SafeERC20, and standard ERC20 interfaces. The auditing reference for Solidity.",
    },
    {
      k: "Solidity",
      v: "0.8.30",
      d: "Latest stable compiler. Built-in overflow checks. No experimental flags.",
    },
    {
      k: "Foundry",
      v: "23 tests",
      d: "Property-style tests cover plan creation, subscribe, recurring charge, three-way split, cancellation, and edge cases.",
    },
  ];
  return (
    <section className="hairline-b">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <Pill>Foundations</Pill>
            <h2 className="mt-4 text-[32px] leading-tight tracking-[-0.02em] font-700">
              Built on primitives, not promises.
            </h2>
          </div>
          <a
            href="https://github.com/Trevor00s/Cadence/blob/main/contracts/src/SubscriptionManager.sol"
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline text-[12px] font-mono text-muted-foreground hover:text-[color:var(--accent-ink)]"
          >
            read the contract →
          </a>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((it) => (
            <div key={it.k} className="border border-rule rounded-md bg-card p-5">
              <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
                {it.k.toLowerCase()}
              </div>
              <div className="mt-1 text-[18px] font-700 tracking-tight">
                {it.v}
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                {it.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
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
        <div className="grid lg:grid-cols-[1fr_460px] gap-12 lg:gap-16 items-start">
          <div className="max-w-[640px]">
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

          <ReceiptCard />
        </div>
      </section>

      <MetricsBoard />

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

      <FlowDiagram />

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

      <BuiltOn />

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
