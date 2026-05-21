import type { Address, PublicClient, WalletClient, Hash } from 'viem'
import { decodeEventLog } from 'viem'
import { subscriptionManagerAbi } from './abi.js'
import type { PermitSingle } from './permit.js'

export interface CadenceClientConfig {
  manager: Address
  publicClient: PublicClient
  walletClient?: WalletClient
}

export class CadenceClient {
  readonly manager: Address
  readonly publicClient: PublicClient
  readonly walletClient?: WalletClient

  constructor(config: CadenceClientConfig) {
    this.manager = config.manager
    this.publicClient = config.publicClient
    this.walletClient = config.walletClient
  }

  // -------------- merchant --------------

  async createPlan(args: {
    account: Address
    token: Address
    amount: bigint
    period: number
    bountyBps: number
  }): Promise<{ txHash: Hash; planId: bigint }> {
    const wc = this.requireWallet()
    const { request, result } = await this.publicClient.simulateContract({
      address: this.manager,
      abi: subscriptionManagerAbi,
      functionName: 'createPlan',
      args: [args.token, args.amount, args.period, args.bountyBps],
      account: args.account,
    })
    const txHash = await wc.writeContract(request)
    return { txHash, planId: result as bigint }
  }

  async deactivatePlan(account: Address, planId: bigint): Promise<Hash> {
    const wc = this.requireWallet()
    return wc.writeContract({
      address: this.manager,
      abi: subscriptionManagerAbi,
      functionName: 'deactivatePlan',
      args: [planId],
      account,
      chain: null,
    })
  }

  // -------------- subscriber --------------

  async subscribe(args: {
    account: Address
    planId: bigint
    permitSingle: PermitSingle
    signature: `0x${string}`
  }): Promise<Hash> {
    const wc = this.requireWallet()
    return wc.writeContract({
      address: this.manager,
      abi: subscriptionManagerAbi,
      functionName: 'subscribe',
      args: [args.planId, args.permitSingle, args.signature],
      account: args.account,
      chain: null,
    })
  }

  async cancel(account: Address, subId: bigint): Promise<Hash> {
    const wc = this.requireWallet()
    return wc.writeContract({
      address: this.manager,
      abi: subscriptionManagerAbi,
      functionName: 'cancel',
      args: [subId],
      account,
      chain: null,
    })
  }

  // -------------- keeper --------------

  async charge(account: Address, subId: bigint): Promise<Hash> {
    const wc = this.requireWallet()
    return wc.writeContract({
      address: this.manager,
      abi: subscriptionManagerAbi,
      functionName: 'charge',
      args: [subId],
      account,
      chain: null,
    })
  }

  // -------------- reads --------------

  async getPlan(planId: bigint) {
    const [merchant, token, amount, period, bountyBps, active] =
      await this.publicClient.readContract({
        address: this.manager,
        abi: subscriptionManagerAbi,
        functionName: 'plans',
        args: [planId],
      })
    return { merchant, token, amount, period, bountyBps, active }
  }

  async getSubscription(subId: bigint) {
    const [planId, subscriber, nextCharge, createdAt, cancelled] =
      await this.publicClient.readContract({
        address: this.manager,
        abi: subscriptionManagerAbi,
        functionName: 'subscriptions',
        args: [subId],
      })
    return { planId, subscriber, nextCharge, createdAt, cancelled }
  }

  async isDue(subId: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.manager,
      abi: subscriptionManagerAbi,
      functionName: 'isDue',
      args: [subId],
    })
  }

  // -------------- helpers --------------

  /** Parse the Subscribed event from a tx receipt and return the new subId. */
  async getSubscribedSubId(txHash: Hash): Promise<bigint | null> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.manager.toLowerCase()) continue
      try {
        const decoded = decodeEventLog({
          abi: subscriptionManagerAbi,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'Subscribed') {
          const args = decoded.args as { subId: bigint }
          return args.subId
        }
      } catch {
        // not one of our events
      }
    }
    return null
  }

  private requireWallet(): WalletClient {
    if (!this.walletClient) throw new Error('walletClient required for write calls')
    return this.walletClient
  }
}
