import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import {
  ARC_TESTNET,
  arcTestnet,
  subscriptionManagerAbi,
} from "@/lib/cadence/chain";
import {
  formatUsdc,
  parseUsdc,
  periodLabel,
  shortAddr,
} from "@/lib/cadence/permit2";
import { ClientOnly } from "@/components/cadence/Providers";

export const Route = createFileRoute("/merchant")({
  head: () => ({
    meta: [
      { title: "Merchant. Create a plan. Cadence." },
      {
        name: "description",
        content:
          "Define amount, period, and keeper bounty. The plan is yours, customers subscribe with one signature.",
      },
    ],
  }),
  component: () => (
    <ClientOnly>
      <MerchantPage />
    </ClientOnly>
  ),
});

const PERIODS: { label: string; seconds: number }[] = [
  { label: "Daily", seconds: 86400 },
  { label: "Weekly", seconds: 7 * 86400 },
  { label: "Monthly (30d)", seconds: 30 * 86400 },
  { label: "Yearly (365d)", seconds: 365 * 86400 },
];

function MerchantPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== arcTestnet.id;

  const [amount, setAmount] = useState("10");
  const [period, setPeriod] = useState(PERIODS[2].seconds);
  const [bounty, setBounty] = useState(50);
  const [copied, setCopied] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<bigint | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, data: txHash, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // When confirmed, decode the planId by reading nextPlanId - 1 (simpler than log parsing).
  useEffect(() => {
    if (!isSuccess || !txHash || !publicClient) return;
    (async () => {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        // Try to read planId from PlanCreated event topic[1] if present, else fall back.
        const topic = receipt.logs.find(
          (l) =>
            l.address.toLowerCase() ===
            ARC_TESTNET.subscriptionManager.toLowerCase(),
        );
        if (topic && topic.topics[1]) {
          setCreatedPlanId(BigInt(topic.topics[1]));
          return;
        }
        const next = await publicClient.readContract({
          address: ARC_TESTNET.subscriptionManager,
          abi: subscriptionManagerAbi,
          functionName: "nextPlanId",
        });
        setCreatedPlanId(next - 1n);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [isSuccess, txHash, publicClient]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!isConnected) {
      setSubmitError("Connect a wallet first.");
      return;
    }
    if (wrongChain) {
      switchChain({ chainId: arcTestnet.id });
      return;
    }
    setCreatedPlanId(null);
    try {
      const raw = parseUsdc(amount);
      await writeContractAsync({
        address: ARC_TESTNET.subscriptionManager,
        abi: subscriptionManagerAbi,
        functionName: "createPlan",
        args: [ARC_TESTNET.usdc, raw, period, bounty],
      });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      // viem prepends a long message header; the shortMessage is more useful.
      const shortMsg =
        (err as { shortMessage?: string })?.shortMessage ||
        msg.split("\n")[0];
      setSubmitError(shortMsg);
    }
  }

  const checkoutUrl =
    typeof window !== "undefined" && createdPlanId !== null
      ? `${window.location.origin}/subscribe?plan=${createdPlanId.toString()}`
      : "";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      <div className="max-w-[720px]">
        <div className="font-mono text-[12px] text-[color:var(--accent-ink)]">
          merchant console
        </div>
        <h1 className="mt-2 text-[40px] tracking-[-0.025em] leading-[1.05] font-800">
          Create a plan.
        </h1>
        <p className="mt-3 text-[16px] text-muted-foreground max-w-prose">
          Charges in USDC on Arc. The plan is yours. Customers subscribe with a
          single Permit2 signature.
        </p>
      </div>

      {!isConnected ? (
        <div className="mt-10 border border-rule rounded-md bg-card p-8 max-w-[560px]">
          <div className="text-[14px] text-muted-foreground">
            Connect a wallet to create plans owned by your address.
          </div>
          <div className="mt-4">
            <ConnectButton />
          </div>
        </div>
      ) : wrongChain ? (
        <WrongChainCard onSwitch={() => switchChain({ chainId: arcTestnet.id })} />
      ) : (
        <div className="mt-10 grid lg:grid-cols-[560px_1fr] gap-10">
          <form
            onSubmit={handleCreate}
            className="border border-rule rounded-md bg-card p-6 space-y-6"
          >
            <Field label="Amount" hint="USDC, 6 decimal precision.">
              <div className="flex items-stretch">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 rounded-l-md border border-rule bg-background px-3 py-2.5 text-[15px] font-600 tabular outline-none focus:border-foreground"
                  required
                />
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-rule bg-muted text-[13px] font-600 text-muted-foreground">
                  USDC
                </span>
              </div>
            </Field>

            <Field label="Period">
              <div className="grid grid-cols-4 gap-2">
                {PERIODS.map((p) => (
                  <button
                    key={p.seconds}
                    type="button"
                    onClick={() => setPeriod(p.seconds)}
                    className={
                      "rounded-md border px-2 py-2 text-[13px] font-600 " +
                      (period === p.seconds
                        ? "border-foreground bg-foreground text-background"
                        : "border-rule hover:border-muted-foreground")
                    }
                  >
                    {p.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label="Keeper bounty"
              hint="Basis points (1/100 of a percent) paid to whoever triggers each renewal. Higher bounty means faster execution."
            >
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="10"
                  value={bounty}
                  onChange={(e) => setBounty(Number(e.target.value))}
                  className="flex-1 accent-[color:var(--accent-ink)]"
                />
                <div className="font-mono text-[14px] w-20 text-right tabular">
                  {bounty} bps
                </div>
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                {(bounty / 100).toFixed(2)}% of each {amount || "0"} USDC charge.
              </div>
            </Field>

            <button
              type="submit"
              disabled={isPending || confirming}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-[14px] font-600 text-primary-foreground disabled:opacity-60"
            >
              {(isPending || confirming) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isPending
                ? "Confirm in wallet"
                : confirming
                  ? "Creating plan…"
                  : "Create plan"}
            </button>

            {submitError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[13px] text-destructive">
                {submitError}
              </div>
            )}

            {createdPlanId !== null && txHash && (
              <div className="mt-2 border-t border-rule pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-600">
                    Plan created
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      reset();
                      setCreatedPlanId(null);
                    }}
                    className="text-[12px] underline text-muted-foreground"
                  >
                    Create another
                  </button>
                </div>
                <Row k="Plan ID" v={<span className="font-mono">{createdPlanId.toString()}</span>} />
                <Row
                  k="Transaction"
                  v={
                    <a
                      href={`${ARC_TESTNET.explorer}/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[12px] hover:text-[color:var(--accent-ink)] inline-flex items-center gap-1"
                    >
                      {shortAddr(txHash)} <ExternalLink className="h-3 w-3" />
                    </a>
                  }
                />
                <Row k="Merchant" v={<span className="font-mono text-[12px]">{address}</span>} />
                <div className="rounded-md border border-rule bg-muted/40 p-3">
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-600 mb-1.5">
                    Shareable checkout
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={checkoutUrl}
                      className="flex-1 bg-transparent font-mono text-[12px] outline-none truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(checkoutUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-rule px-2 py-1 text-[12px] hover:bg-background"
                    >
                      {copied ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>

          <div>
            <YourPlans address={address!} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-600 uppercase tracking-[0.08em] text-muted-foreground mb-2">
        {label}
      </label>
      {children}
      {hint && (
        <div className="mt-1 text-[12px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[13px] gap-3">
      <div className="text-muted-foreground">{k}</div>
      <div className="truncate">{v}</div>
    </div>
  );
}

function WrongChainCard({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div className="mt-10 border border-rule rounded-md bg-card p-6 max-w-[560px]">
      <div className="text-[14px]">
        Wrong network. Cadence runs on Arc Testnet (chain 5042002).
      </div>
      <button
        onClick={onSwitch}
        className="mt-3 rounded-md bg-primary px-3 py-2 text-[13px] font-600 text-primary-foreground"
      >
        Switch to Arc Testnet
      </button>
    </div>
  );
}

function YourPlans({ address }: { address: `0x${string}` }) {
  const publicClient = usePublicClient();
  const { data: nextPlanId } = useReadContract({
    address: ARC_TESTNET.subscriptionManager,
    abi: subscriptionManagerAbi,
    functionName: "nextPlanId",
  });

  const [plans, setPlans] = useState<
    { id: bigint; merchant: string; token: string; amount: bigint; period: number; bountyBps: number; active: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!publicClient || nextPlanId === undefined) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const ids = [] as bigint[];
      for (let i = 0n; i < nextPlanId; i++) ids.push(i);
      const results = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: ARC_TESTNET.subscriptionManager,
            abi: subscriptionManagerAbi,
            functionName: "plans",
            args: [id],
          }),
        ),
      );
      if (cancelled) return;
      const mine = results
        .map((r, i) => ({
          id: ids[i],
          merchant: r[0] as string,
          token: r[1] as string,
          amount: r[2] as bigint,
          period: Number(r[3]),
          bountyBps: Number(r[4]),
          active: r[5] as boolean,
        }))
        .filter((p) => p.merchant.toLowerCase() === address.toLowerCase());
      setPlans(mine);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [nextPlanId, publicClient, address, version]);

  const { writeContractAsync, isPending } = useWriteContract();

  async function handleDeactivate(id: bigint) {
    try {
      const hash = await writeContractAsync({
        address: ARC_TESTNET.subscriptionManager,
        abi: subscriptionManagerAbi,
        functionName: "deactivatePlan",
        args: [id],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setVersion((v) => v + 1);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-700 tracking-tight">Your plans</h2>
        <div className="font-mono text-[11px] text-muted-foreground">
          {plans.length} owned
        </div>
      </div>
      {loading ? (
        <div className="text-[13px] text-muted-foreground">Loading plans…</div>
      ) : plans.length === 0 ? (
        <div className="border border-dashed border-rule rounded-md p-6 text-[13px] text-muted-foreground">
          No plans yet. Create one on the left.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <div
              key={p.id.toString()}
              className="border border-rule rounded-md bg-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[18px] font-700 tabular">
                    {formatUsdc(p.amount)} USDC
                    <span className="text-muted-foreground font-500 text-[14px]">
                      {" "}
                      / {periodLabel(p.period)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[12px] text-muted-foreground font-mono">
                    <span>plan #{p.id.toString()}</span>
                    <span>{p.bountyBps} bps bounty</span>
                    <span
                      className={
                        p.active
                          ? "text-[color:var(--accent-ink)]"
                          : "text-muted-foreground"
                      }
                    >
                      {p.active ? "active" : "deactivated"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeactivate(p.id)}
                  disabled={!p.active || isPending}
                  className="rounded-md border border-rule px-3 py-1.5 text-[12px] font-600 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
