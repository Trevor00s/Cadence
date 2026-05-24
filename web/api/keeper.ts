// Vercel Cron Function. Scans the SubscriptionManager for due subscriptions
// and fires charge(subId) on each one, claiming the keeper bounty in the
// process. Reads its signing key from env: KEEPER_KEY.
//
// Schedule lives in web/vercel.json under `crons`. By default it runs every
// hour, which lines up with the contract's MIN_PERIOD of 1 hour.
//
// To enable: set KEEPER_KEY in the Vercel project's env vars to a 0x prefixed
// private key for a wallet funded with a tiny amount of USDC on Arc Testnet.

import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ARC_TESTNET,
  arcTestnet,
  subscriptionManagerAbi,
} from "../src/lib/cadence/chain";

export const config = { runtime: "nodejs", maxDuration: 60 };

const MAX_SUBS_PER_TICK = 50;
const MAX_RETRIES_PER_SUB = 1;

interface TickResult {
  ok: boolean;
  scanned: number;
  charged: number;
  failed: number;
  details: Array<{ subId: string; status: "charged" | "skipped" | "failed"; tx?: string; error?: string }>;
}

export default async function handler(req: Request): Promise<Response> {
  // Vercel cron requests include a special header for authentication when
  // CRON_SECRET is set. We also accept manual triggers from anyone with the
  // secret, useful for ops.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const keeperKey = process.env.KEEPER_KEY as Hex | undefined;
  if (!keeperKey || !keeperKey.startsWith("0x") || keeperKey.length !== 66) {
    return Response.json(
      { ok: false, error: "KEEPER_KEY missing or malformed" },
      { status: 500 },
    );
  }

  const account = privateKeyToAccount(keeperKey);
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const manager = ARC_TESTNET.subscriptionManager as Address;

  const nextSubId = (await publicClient.readContract({
    address: manager,
    abi: subscriptionManagerAbi,
    functionName: "nextSubId",
  })) as bigint;

  const out: TickResult = {
    ok: true,
    scanned: 0,
    charged: 0,
    failed: 0,
    details: [],
  };

  // Walk the tail end first; new subs are more likely to be due soon than
  // ancient cancelled ones.
  const start =
    nextSubId > BigInt(MAX_SUBS_PER_TICK)
      ? nextSubId - BigInt(MAX_SUBS_PER_TICK)
      : 0n;

  for (let id = start; id < nextSubId; id++) {
    out.scanned += 1;
    let due = false;
    try {
      due = (await publicClient.readContract({
        address: manager,
        abi: subscriptionManagerAbi,
        functionName: "isDue",
        args: [id],
      })) as boolean;
    } catch (e) {
      out.details.push({
        subId: id.toString(),
        status: "failed",
        error: `isDue read failed: ${String(e)}`,
      });
      out.failed += 1;
      continue;
    }
    if (!due) continue;

    let attempts = 0;
    while (attempts <= MAX_RETRIES_PER_SUB) {
      try {
        const hash = await walletClient.writeContract({
          address: manager,
          abi: subscriptionManagerAbi,
          functionName: "charge",
          args: [id],
        });
        await publicClient.waitForTransactionReceipt({ hash, timeout: 15_000 });
        out.charged += 1;
        out.details.push({ subId: id.toString(), status: "charged", tx: hash });
        break;
      } catch (e) {
        attempts += 1;
        if (attempts > MAX_RETRIES_PER_SUB) {
          out.failed += 1;
          out.details.push({
            subId: id.toString(),
            status: "failed",
            error: String(e),
          });
        }
      }
    }
  }

  return Response.json(out);
}
