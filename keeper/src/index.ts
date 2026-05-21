import 'dotenv/config'
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  arcTestnet,
  CadenceClient,
  subscriptionManagerAbi,
} from '@cadence/sdk'

interface Env {
  keeperKey: Hex
  manager: Address
  rpcUrl: string
  pollIntervalMs: number
  startFromSubId: bigint
}

function loadEnv(): Env {
  const key = process.env.KEEPER_KEY
  const manager = process.env.SUBSCRIPTION_MANAGER
  if (!key || !key.startsWith('0x') || key.length !== 66) {
    throw new Error('KEEPER_KEY missing or malformed')
  }
  if (!manager || !manager.startsWith('0x') || manager.length !== 42) {
    throw new Error('SUBSCRIPTION_MANAGER missing or malformed')
  }
  return {
    keeperKey: key as Hex,
    manager: manager as Address,
    rpcUrl: process.env.RPC_URL ?? 'https://rpc.testnet.arc.network',
    pollIntervalMs: (Number(process.env.POLL_INTERVAL_SECONDS) || 30) * 1000,
    startFromSubId: BigInt(process.env.START_FROM_SUB_ID ?? '0'),
  }
}

function log(msg: string, extra?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  if (extra) {
    console.log(`[${ts}] ${msg}`, extra)
  } else {
    console.log(`[${ts}] ${msg}`)
  }
}

async function main() {
  const env = loadEnv()
  const account = privateKeyToAccount(env.keeperKey)

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(env.rpcUrl),
  })
  const walletClient = createWalletClient({
    chain: arcTestnet,
    transport: http(env.rpcUrl),
    account,
  })

  const cadence = new CadenceClient({
    manager: env.manager,
    publicClient,
    walletClient,
  })

  log('keeper starting', {
    keeper: account.address,
    manager: env.manager,
    rpc: env.rpcUrl,
    interval: env.pollIntervalMs / 1000 + 's',
  })

  let cursor = env.startFromSubId

  // Track recently-attempted subs to back off after a failed charge.
  const backoffUntil = new Map<bigint, number>()

  async function tick() {
    const nextSubId = (await publicClient
      .readContract({
        address: env.manager,
        abi: subscriptionManagerAbi,
        functionName: 'nextSubId',
      })
      .catch(() => 0n)) as bigint

    if (nextSubId === 0n) return

    const candidates: bigint[] = []
    for (let id = cursor; id < nextSubId; id++) {
      candidates.push(id)
    }
    if (candidates.length === 0) return

    const now = Date.now()
    for (const subId of candidates) {
      const backoff = backoffUntil.get(subId) ?? 0
      if (backoff > now) continue

      let due = false
      try {
        due = await cadence.isDue(subId)
      } catch (err) {
        log('isDue failed', { subId: subId.toString(), err: String(err) })
        continue
      }
      if (!due) continue

      log('charging', { subId: subId.toString() })
      try {
        const hash = await cadence.charge(account.address, subId)
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        log('charged', {
          subId: subId.toString(),
          tx: hash,
          status: receipt.status,
        })
      } catch (err) {
        log('charge failed', { subId: subId.toString(), err: String(err) })
        // Back off this sub for 10 minutes after a failure (e.g. insufficient
        // balance). Other subs in the same tick still get attempted.
        backoffUntil.set(subId, now + 10 * 60 * 1000)
      }
    }
  }

  // Keep cursor at lowest unseen sub. Once a sub is charged or cancelled it
  // remains in the loop but isDue() returns false, so the cost is one view call.
  // For a long-running keeper, persisting cursor to disk and pruning cancelled
  // subs is the obvious next step.

  while (true) {
    try {
      await tick()
    } catch (err) {
      log('tick error', { err: String(err) })
    }
    await new Promise((r) => setTimeout(r, env.pollIntervalMs))
  }
}

main().catch((err) => {
  console.error('fatal', err)
  process.exit(1)
})
