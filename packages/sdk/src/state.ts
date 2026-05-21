import type { Address, PublicClient } from 'viem'
import { subscriptionManagerAbi } from './abi.js'

/**
 * Lifecycle state of a subscription, useful for gating SaaS features.
 *
 *  active           paid through the current period; user is entitled.
 *  due              the current period elapsed but no charge yet executed.
 *                   Keeper-side concern. Most SaaS apps should NOT treat
 *                   `due` as entitled: gate the user until charge() lands.
 *  cancelled        subscriber called cancel(). No more charges will succeed.
 *  plan_inactive    merchant called deactivatePlan(). No more charges.
 *  not_found        the subId does not exist on this manager.
 */
export type SubscriptionState =
  | 'active'
  | 'due'
  | 'cancelled'
  | 'plan_inactive'
  | 'not_found'

export interface SubscriptionStatus {
  state: SubscriptionState
  subId: bigint
  planId: bigint
  subscriber: Address
  /** Unix seconds. Zero if the sub doesn't exist. */
  nextCharge: number
  /** True iff the SaaS should currently grant access. */
  isEntitled: boolean
}

/**
 * Read the current state of a subscription. The default `gateLapsed: true`
 * means a sub past `nextCharge` is NOT considered entitled until a keeper
 * fires `charge()`. Set to `false` if you want a grace window.
 */
export async function getSubscriptionStatus(
  publicClient: PublicClient,
  manager: Address,
  subId: bigint,
  options?: { gateLapsed?: boolean },
): Promise<SubscriptionStatus> {
  const gateLapsed = options?.gateLapsed ?? true
  const nextSubId = (await publicClient.readContract({
    address: manager,
    abi: subscriptionManagerAbi,
    functionName: 'nextSubId',
  })) as bigint

  if (subId >= nextSubId) {
    return {
      state: 'not_found',
      subId,
      planId: 0n,
      subscriber: '0x0000000000000000000000000000000000000000',
      nextCharge: 0,
      isEntitled: false,
    }
  }

  const [planId, subscriber, nextCharge, , cancelled] =
    (await publicClient.readContract({
      address: manager,
      abi: subscriptionManagerAbi,
      functionName: 'subscriptions',
      args: [subId],
    })) as readonly [bigint, Address, number, number, boolean]

  if (cancelled) {
    return { state: 'cancelled', subId, planId, subscriber, nextCharge, isEntitled: false }
  }

  const [, , , , , active] = (await publicClient.readContract({
    address: manager,
    abi: subscriptionManagerAbi,
    functionName: 'plans',
    args: [planId],
  })) as readonly [Address, Address, bigint, number, number, boolean]

  if (!active) {
    return { state: 'plan_inactive', subId, planId, subscriber, nextCharge, isEntitled: false }
  }

  const now = Math.floor(Date.now() / 1000)
  if (now >= nextCharge) {
    return {
      state: 'due',
      subId,
      planId,
      subscriber,
      nextCharge,
      isEntitled: !gateLapsed,
    }
  }

  return { state: 'active', subId, planId, subscriber, nextCharge, isEntitled: true }
}

/**
 * Find all subscriptions for an address, optionally filtered to a single plan.
 * This walks `subscriptions(0..nextSubId)` and filters. For large managers
 * (thousands of subs) you want an indexer; for typical SaaS use this is fine.
 */
export async function findSubscriptionsForAddress(
  publicClient: PublicClient,
  manager: Address,
  subscriber: Address,
  options?: { planId?: bigint; limit?: number },
): Promise<SubscriptionStatus[]> {
  const planFilter = options?.planId
  const limit = options?.limit ?? Number.MAX_SAFE_INTEGER

  const nextSubId = (await publicClient.readContract({
    address: manager,
    abi: subscriptionManagerAbi,
    functionName: 'nextSubId',
  })) as bigint

  const out: SubscriptionStatus[] = []
  for (let id = 0n; id < nextSubId && out.length < limit; id++) {
    const status = await getSubscriptionStatus(publicClient, manager, id)
    if (status.subscriber.toLowerCase() !== subscriber.toLowerCase()) continue
    if (planFilter !== undefined && status.planId !== planFilter) continue
    out.push(status)
  }
  return out
}

/**
 * Convenience: is the given wallet currently entitled to a specific plan?
 * Returns true iff they hold at least one active subscription on that plan.
 */
export async function hasActiveSubscription(
  publicClient: PublicClient,
  manager: Address,
  subscriber: Address,
  planId: bigint,
): Promise<boolean> {
  const subs = await findSubscriptionsForAddress(publicClient, manager, subscriber, { planId })
  return subs.some((s) => s.isEntitled)
}
