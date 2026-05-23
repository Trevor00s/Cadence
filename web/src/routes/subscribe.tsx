import { createFileRoute, Link } from "@tanstack/react-router";
// minimal validator: optional `plan` string
import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import {
  ARC_TESTNET,
  arcTestnet,
  erc20Abi,
  permit2Abi,
  subscriptionManagerAbi,
} from "@/lib/cadence/chain";
import {
  PERMIT2_DOMAIN,
  PERMIT2_TYPES,
  MAX_UINT160,
  expirationDefault,
  formatUsdc,
  periodLong,
  shortAddr,
  sigDeadlineDefault,
} from "@/lib/cadence/permit2";
import { ClientOnly } from "@/components/cadence/Providers";
import { humanizeError } from "@/lib/cadence/errors";
import { PlanCardSkeleton } from "@/components/cadence/Skeleton";

type SubscribeSearch = { plan?: number };

export const Route = createFileRoute("/subscribe")({
  validateSearch: (raw: Record<string, unknown>): SubscribeSearch => {
    const v = raw.plan;
    if (v === undefined || v === null || v === "") return {};
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? { plan: Math.floor(n) } : {};
  },
  head: () => ({
    meta: [
      { title: "Subscribe. Cadence Drip." },
      {
        name: "description",
        content:
          "Subscribe to a plan with one Permit2 signature on Arc. Cancel any time.",
      },
    ],
  }),
  component: () => (
    <ClientOnly>
      <SubscribePage />
    </ClientOnly>
  ),
});

function SubscribePage() {
  const { plan } = Route.useSearch();
  const planId = useMemo(() => {
    if (plan === undefined) return null;
    try {
      return BigInt(plan);
    } catch {
      return null;
    }
  }, [plan]);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
        checkout
      </div>
      <h1 className="mt-2 text-[36px] tracking-[-0.025em] leading-[1.05] font-800">
        Subscribe.
      </h1>
      {planId === null ? (
        <NoPlan />
      ) : (
        <SubscribeFlow planId={planId} />
      )}
    </div>
  );
}

function NoPlan() {
  return (
    <div className="mt-8 space-y-6">
      <div className="border border-rule rounded-md bg-card p-6">
        <div className="text-[14px] text-muted-foreground">
          Pick a plan below, or open a direct checkout link like{" "}
          <code className="font-mono text-foreground">/subscribe?plan=0</code>.
          Merchants create plans on the{" "}
          <Link to="/merchant" className="underline">
            merchant console
          </Link>
          .
        </div>
      </div>
      <PlanBrowser />
    </div>
  );
}

function PlanBrowser() {
  const publicClient = usePublicClient();
  const [plans, setPlans] = useState<
    | {
        planId: bigint;
        merchant: `0x${string}`;
        token: `0x${string}`;
        amount: bigint;
        period: number;
        bountyBps: number;
        active: boolean;
      }[]
    | null
  >(null);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    (async () => {
      try {
        const nextPlanId = (await publicClient.readContract({
          address: ARC_TESTNET.subscriptionManager,
          abi: subscriptionManagerAbi,
          functionName: "nextPlanId",
        })) as bigint;

        const collected: NonNullable<typeof plans> = [];
        for (let id = 0n; id < nextPlanId; id++) {
          const [merchant, token, amount, period, bountyBps, active] =
            (await publicClient.readContract({
              address: ARC_TESTNET.subscriptionManager,
              abi: subscriptionManagerAbi,
              functionName: "plans",
              args: [id],
            })) as readonly [
              `0x${string}`,
              `0x${string}`,
              bigint,
              number,
              number,
              boolean,
            ];
          collected.push({
            planId: id,
            merchant,
            token,
            amount,
            period,
            bountyBps,
            active,
          });
        }
        if (!cancelled) setPlans(collected.reverse());
      } catch {
        if (!cancelled) setPlans([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  if (plans === null) {
    return (
      <div>
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-600 mb-3">
          Available plans
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <PlanCardSkeleton />
          <PlanCardSkeleton />
        </div>
      </div>
    );
  }
  if (plans.length === 0) {
    return (
      <div className="border border-rule rounded-md bg-card p-6 text-[14px] text-muted-foreground">
        No plans created yet. A merchant needs to create one first via the{" "}
        <Link to="/merchant" className="underline">
          merchant console
        </Link>
        .
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-600">
          Available plans
        </div>
        <div className="text-[11px] text-muted-foreground font-mono">
          {plans.filter((p) => p.active).length} active /{" "}
          {plans.length} total
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {plans.map((p) => (
          <div
            key={p.planId.toString()}
            className="border border-rule rounded-md bg-card p-5 flex flex-col"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] text-muted-foreground">
                plan #{p.planId.toString()}
              </span>
              <span
                className={
                  "text-[10px] font-600 uppercase tracking-[0.08em] " +
                  (p.active
                    ? "text-[color:var(--accent-ink)]"
                    : "text-muted-foreground")
                }
              >
                {p.active ? "active" : "inactive"}
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2 tabular">
              <span className="text-[24px] font-700 tracking-[-0.02em]">
                {formatUsdc(p.amount)}
              </span>
              <span className="text-[13px] text-muted-foreground">USDC</span>
            </div>
            <div className="text-[12.5px] text-muted-foreground">
              every {periodLong(p.period)}
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground font-mono">
              merchant {shortAddr(p.merchant)}
            </div>
            <Link
              to="/subscribe"
              search={{ plan: Number(p.planId) }}
              className={
                "mt-5 inline-flex items-center justify-center rounded-md px-3 py-2 text-[13px] font-600 " +
                (p.active
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-rule text-muted-foreground pointer-events-none")
              }
            >
              {p.active ? "Open checkout" : "Inactive"}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

type Plan = {
  merchant: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  period: number;
  bountyBps: number;
  active: boolean;
};

function SubscribeFlow({ planId }: { planId: bigint }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== arcTestnet.id;
  const publicClient = usePublicClient();

  const { data: planRaw, isLoading } = useReadContract({
    address: ARC_TESTNET.subscriptionManager,
    abi: subscriptionManagerAbi,
    functionName: "plans",
    args: [planId],
  });

  const plan: Plan | null = useMemo(() => {
    if (!planRaw) return null;
    return {
      merchant: planRaw[0] as `0x${string}`,
      token: planRaw[1] as `0x${string}`,
      amount: planRaw[2] as bigint,
      period: Number(planRaw[3]),
      bountyBps: Number(planRaw[4]),
      active: planRaw[5] as boolean,
    };
  }, [planRaw]);

  // Detect existing subscription
  const [existingSubId, setExistingSubId] = useState<bigint | null>(null);
  const { data: nextSubId } = useReadContract({
    address: ARC_TESTNET.subscriptionManager,
    abi: subscriptionManagerAbi,
    functionName: "nextSubId",
  });
  useEffect(() => {
    if (!publicClient || !address || nextSubId === undefined) return;
    let cancelled = false;
    (async () => {
      const ids: bigint[] = [];
      for (let i = 0n; i < nextSubId; i++) ids.push(i);
      const subs = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: ARC_TESTNET.subscriptionManager,
            abi: subscriptionManagerAbi,
            functionName: "subscriptions",
            args: [id],
          }),
        ),
      );
      if (cancelled) return;
      const mine = subs.findIndex(
        (s) =>
          (s[1] as string).toLowerCase() === address.toLowerCase() &&
          (s[0] as bigint) === planId &&
          (s[4] as boolean) === false,
      );
      setExistingSubId(mine >= 0 ? ids[mine] : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, address, nextSubId, planId]);

  // Step state machine
  const [step, setStep] = useState<"idle" | "approve" | "sign" | "subscribe" | "done">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [resultTx, setResultTx] = useState<`0x${string}` | null>(null);
  const [newSubId, setNewSubId] = useState<bigint | null>(null);

  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  async function handleSubscribe() {
    if (!plan || !address || !publicClient) return;
    setError(null);
    try {
      // 1. Check ERC20 allowance to Permit2
      const erc20Allow = (await publicClient.readContract({
        address: plan.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, ARC_TESTNET.permit2],
      })) as bigint;

      if (erc20Allow < plan.amount) {
        setStep("approve");
        const hash = await writeContractAsync({
          address: plan.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [ARC_TESTNET.permit2, 2n ** 256n - 1n],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // 2. Read Permit2 nonce
      setStep("sign");
      const permit2State = (await publicClient.readContract({
        address: ARC_TESTNET.permit2,
        abi: permit2Abi,
        functionName: "allowance",
        args: [address, plan.token, ARC_TESTNET.subscriptionManager],
      })) as readonly [bigint, number, number];
      const nonce = permit2State[2];

      const permitSingle = {
        details: {
          token: plan.token,
          amount: MAX_UINT160,
          expiration: expirationDefault(),
          nonce,
        },
        spender: ARC_TESTNET.subscriptionManager,
        sigDeadline: sigDeadlineDefault(),
      } as const;

      const signature = await signTypedDataAsync({
        domain: PERMIT2_DOMAIN,
        types: PERMIT2_TYPES,
        primaryType: "PermitSingle",
        message: {
          details: {
            token: plan.token,
            amount: MAX_UINT160,
            expiration: permitSingle.details.expiration,
            nonce: permitSingle.details.nonce,
          },
          spender: permitSingle.spender,
          sigDeadline: permitSingle.sigDeadline,
        } as any,
      });

      // 3. Subscribe
      setStep("subscribe");
      const hash = await writeContractAsync({
        address: ARC_TESTNET.subscriptionManager,
        abi: subscriptionManagerAbi,
        functionName: "subscribe",
        args: [planId, permitSingle as any, signature],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setResultTx(hash);
      // best-effort newSubId
      const next = (await publicClient.readContract({
        address: ARC_TESTNET.subscriptionManager,
        abi: subscriptionManagerAbi,
        functionName: "nextSubId",
      })) as bigint;
      setNewSubId(next - 1n);
      setStep("done");
    } catch (e) {
      console.error(e);
      setError(humanizeError(e));
      setStep("idle");
    }
  }

  if (isLoading || !plan) {
    return (
      <div className="mt-8 text-[14px] text-muted-foreground">
        Reading plan #{planId.toString()}…
      </div>
    );
  }

  const planExists =
    plan.merchant !== "0x0000000000000000000000000000000000000000";

  if (!planExists) {
    return (
      <div className="mt-8 border border-rule rounded-md bg-card p-8">
        <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
          not found
        </div>
        <div className="mt-2 text-[15px] font-600">
          Plan #{planId.toString()} does not exist.
        </div>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Check the plan ID or ask the merchant for a new link.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="border border-rule rounded-md bg-card p-6">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="text-[34px] font-800 tabular leading-none">
              {formatUsdc(plan.amount)} USDC
            </div>
            <div className="mt-1 text-[14px] text-muted-foreground">
              {periodLong(plan.period)}
            </div>
          </div>
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-600 uppercase tracking-[0.08em] " +
              (plan.active
                ? "border-[color:var(--accent-ink)] text-[color:var(--accent-ink)]"
                : "border-rule text-muted-foreground")
            }
          >
            <span
              className={
                "inline-block h-1.5 w-1.5 rounded-full " +
                (plan.active ? "bg-[color:var(--accent-ink)]" : "bg-muted-foreground")
              }
            />
            {plan.active ? "Active" : "Deactivated"}
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 text-[13px]">
          <div>
            <div className="text-muted-foreground text-[11px] uppercase tracking-[0.08em] font-600 mb-1">
              Merchant
            </div>
            <a
              href={`${ARC_TESTNET.explorer}/address/${plan.merchant}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:text-[color:var(--accent-ink)] inline-flex items-center gap-1"
            >
              {shortAddr(plan.merchant)} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px] uppercase tracking-[0.08em] font-600 mb-1">
              Keeper bounty
            </div>
            <div className="font-mono tabular">{plan.bountyBps} bps</div>
          </div>
        </div>
      </div>

      {/* Action */}
      {!isConnected ? (
        <div className="border border-rule rounded-md bg-card p-6">
          <div className="text-[14px] text-muted-foreground mb-3">
            Connect a wallet to subscribe.
          </div>
          <ConnectButton />
        </div>
      ) : wrongChain ? (
        <div className="border border-rule rounded-md bg-card p-6">
          <div className="text-[14px] mb-3">
            Wrong network. Switch to Arc Testnet.
          </div>
          <button
            onClick={() => switchChain({ chainId: arcTestnet.id })}
            className="rounded-md bg-primary px-3 py-2 text-[13px] font-600 text-primary-foreground"
          >
            Switch to Arc Testnet
          </button>
        </div>
      ) : existingSubId !== null ? (
        <div className="border border-rule rounded-md bg-card p-6">
          <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
            already subscribed
          </div>
          <div className="mt-2 text-[15px]">
            You have an active subscription to this plan (sub #
            {existingSubId.toString()}).
          </div>
          <Link
            to="/subscriptions"
            className="mt-3 inline-block underline text-[14px]"
          >
            Go to my subscriptions →
          </Link>
        </div>
      ) : !plan.active ? (
        <div className="border border-rule rounded-md bg-card p-6 text-[14px] text-muted-foreground">
          This plan is no longer accepting subscribers.
        </div>
      ) : step === "done" && resultTx ? (
        <div className="border border-rule rounded-md bg-card p-6 space-y-3">
          <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
            subscribed
          </div>
          <div className="text-[16px] font-600">
            You are subscribed.
          </div>
          <div className="space-y-1.5 text-[13px]">
            {newSubId !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sub ID</span>
                <span className="font-mono">{newSubId.toString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transaction</span>
              <a
                href={`${ARC_TESTNET.explorer}/tx/${resultTx}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono hover:text-[color:var(--accent-ink)] inline-flex items-center gap-1"
              >
                {shortAddr(resultTx)} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <Link
            to="/subscriptions"
            className="inline-block mt-2 underline text-[14px]"
          >
            Go to my subscriptions →
          </Link>
        </div>
      ) : (
        <div className="border border-rule rounded-md bg-card p-6">
          <Steps current={step} />
          <button
            onClick={handleSubscribe}
            disabled={step !== "idle"}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-[14px] font-600 text-primary-foreground disabled:opacity-60"
          >
            {step !== "idle" && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === "idle" && `Subscribe for ${formatUsdc(plan.amount)} USDC`}
            {step === "approve" && "Approving Permit2…"}
            {step === "sign" && "Sign in your wallet"}
            {step === "subscribe" && "Subscribing…"}
            {step === "done" && "Done"}
          </button>
          {error && (
            <div className="mt-3 text-[12px] text-destructive font-mono break-all">
              {error}
            </div>
          )}
          <div className="mt-4 text-[12px] text-muted-foreground">
            First charge happens in the same transaction. You can cancel any
            time on /subscriptions.
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: "idle" | "approve" | "sign" | "subscribe" | "done" }) {
  const labels = [
    { key: "approve", label: "Approve Permit2" },
    { key: "sign", label: "Sign authorization" },
    { key: "subscribe", label: "Subscribe" },
  ];
  const order = ["idle", "approve", "sign", "subscribe", "done"];
  const idx = order.indexOf(current);
  return (
    <ol className="space-y-2.5">
      {labels.map((s, i) => {
        const stepIdx = order.indexOf(s.key);
        const active = current === s.key;
        const done = idx > stepIdx;
        return (
          <li key={s.key} className="flex items-center gap-3 text-[13px]">
            <span
              className={
                "inline-flex h-6 w-6 items-center justify-center rounded-md border text-[11px] font-700 " +
                (done
                  ? "border-[color:var(--accent-ink)] bg-[color:var(--accent-ink)] text-paper"
                  : active
                    ? "border-foreground text-foreground"
                    : "border-rule text-muted-foreground")
              }
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={
                done
                  ? "text-muted-foreground line-through"
                  : active
                    ? "font-600"
                    : "text-muted-foreground"
              }
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
