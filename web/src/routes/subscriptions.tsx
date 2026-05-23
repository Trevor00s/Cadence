import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
import { ARC_TESTNET, subscriptionManagerAbi } from "@/lib/cadence/chain";
import {
  formatUsdc,
  periodLabel,
  relativeTime,
} from "@/lib/cadence/permit2";
import { ClientOnly } from "@/components/cadence/Providers";
import { humanizeError } from "@/lib/cadence/errors";
import { SubscriptionRowSkeleton } from "@/components/cadence/Skeleton";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "My subscriptions. Cadence Drip." },
      {
        name: "description",
        content:
          "Active and past Cadence Drip subscriptions tied to your wallet on Arc.",
      },
    ],
  }),
  component: () => (
    <ClientOnly>
      <SubscriptionsPage />
    </ClientOnly>
  ),
});

type SubRow = {
  id: bigint;
  planId: bigint;
  nextCharge: number;
  createdAt: number;
  cancelled: boolean;
  plan: {
    amount: bigint;
    period: number;
    active: boolean;
    merchant: string;
  };
};

function SubscriptionsPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: nextSubId } = useReadContract({
    address: ARC_TESTNET.subscriptionManager,
    abi: subscriptionManagerAbi,
    functionName: "nextSubId",
  });

  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!publicClient || !address || nextSubId === undefined) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const ids: bigint[] = [];
      for (let i = 0n; i < nextSubId; i++) ids.push(i);
      const raw = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: ARC_TESTNET.subscriptionManager,
            abi: subscriptionManagerAbi,
            functionName: "subscriptions",
            args: [id],
          }),
        ),
      );
      const mineIdx = raw
        .map((s, i) => ({ s, i }))
        .filter(
          ({ s }) =>
            (s[1] as string).toLowerCase() === address.toLowerCase(),
        );
      const plans = await Promise.all(
        mineIdx.map(({ s }) =>
          publicClient.readContract({
            address: ARC_TESTNET.subscriptionManager,
            abi: subscriptionManagerAbi,
            functionName: "plans",
            args: [s[0] as bigint],
          }),
        ),
      );
      if (cancelled) return;
      const rows: SubRow[] = mineIdx.map(({ s, i }, k) => ({
        id: ids[i],
        planId: s[0] as bigint,
        nextCharge: Number(s[2]),
        createdAt: Number(s[3]),
        cancelled: s[4] as boolean,
        plan: {
          amount: plans[k][2] as bigint,
          period: Number(plans[k][3]),
          active: plans[k][5] as boolean,
          merchant: plans[k][0] as string,
        },
      }));
      rows.sort((a, b) => Number(b.id - a.id));
      setSubs(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, address, nextSubId, version]);

  const { writeContractAsync, isPending } = useWriteContract();
  const [cancelingId, setCancelingId] = useState<bigint | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCancel(id: bigint) {
    setCancelingId(id);
    setCancelError(null);
    try {
      const hash = await writeContractAsync({
        address: ARC_TESTNET.subscriptionManager,
        abi: subscriptionManagerAbi,
        functionName: "cancel",
        args: [id],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setVersion((v) => v + 1);
    } catch (e) {
      console.error(e);
      setCancelError(humanizeError(e));
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
        wallet
      </div>
      <h1 className="mt-2 text-[36px] tracking-[-0.025em] leading-[1.05] font-800">
        My subscriptions.
      </h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Active and past subscriptions tied to your wallet.
      </p>

      {!isConnected ? (
        <div className="mt-8 border border-rule rounded-md bg-card p-8">
          <div className="text-[14px] text-muted-foreground mb-3">
            Connect a wallet to view subscriptions.
          </div>
          <ConnectButton />
        </div>
      ) : loading ? (
        <div className="mt-8 space-y-3">
          <SubscriptionRowSkeleton />
          <SubscriptionRowSkeleton />
        </div>
      ) : subs.length === 0 ? (
        <div className="mt-8 border border-dashed border-rule rounded-md p-8 text-[14px] text-muted-foreground">
          You have not subscribed to any plan yet. Try{" "}
          <Link
            to="/subscribe"
            search={{ plan: 0 }}
            className="underline text-foreground"
          >
            /subscribe?plan=0
          </Link>
          .
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {subs.map((s) => {
            const status = s.cancelled
              ? "Cancelled"
              : !s.plan.active
                ? "Plan deactivated"
                : "Active";
            const statusColor =
              status === "Active"
                ? "text-[color:var(--accent-ink)]"
                : "text-muted-foreground";
            const nextDate = new Date(s.nextCharge * 1000);
            return (
              <div
                key={s.id.toString()}
                className="border border-rule rounded-md bg-card p-5"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-[22px] font-700 tabular leading-tight">
                      {formatUsdc(s.plan.amount)} USDC
                      <span className="text-muted-foreground font-500 text-[15px]">
                        {" "}
                        / {periodLabel(s.plan.period)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground font-mono">
                      <span>sub #{s.id.toString()}</span>
                      <span>plan #{s.planId.toString()}</span>
                      <span className={statusColor}>{status.toLowerCase()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancel(s.id)}
                    disabled={
                      s.cancelled ||
                      !s.plan.active ||
                      isPending ||
                      cancelingId === s.id
                    }
                    className="rounded-md border border-rule px-3 py-1.5 text-[12px] font-600 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    {cancelingId === s.id ? "Cancelling…" : "Cancel"}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-[12px]">
                  <div>
                    <div className="text-muted-foreground uppercase tracking-[0.08em] text-[10px] font-600 mb-0.5">
                      Next charge
                    </div>
                    <div className="tabular">
                      {nextDate.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      <span className="text-muted-foreground">
                        ({relativeTime(s.nextCharge)})
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-[0.08em] text-[10px] font-600 mb-0.5">
                      Started
                    </div>
                    <div className="tabular">
                      {new Date(s.createdAt * 1000).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "short", day: "numeric" },
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {cancelError && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[13px] text-destructive">
          {cancelError}
        </div>
      )}
    </div>
  );
}
