import type { Address, WalletClient, PublicClient } from 'viem'
import { PERMIT2_ADDRESS, PERMIT2_DOMAIN_NAME, MAX_UINT160 } from './constants.js'
import { permit2Abi } from './abi.js'

export interface PermitDetails {
  token: Address
  amount: bigint
  expiration: number
  nonce: number
}

export interface PermitSingle {
  details: PermitDetails
  spender: Address
  sigDeadline: bigint
}

const permit2Types = {
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
} as const

export async function getPermit2Nonce(
  publicClient: PublicClient,
  owner: Address,
  token: Address,
  spender: Address,
): Promise<number> {
  const [, , nonce] = await publicClient.readContract({
    address: PERMIT2_ADDRESS,
    abi: permit2Abi,
    functionName: 'allowance',
    args: [owner, token, spender],
  })
  return nonce
}

export interface BuildSubscribePermitArgs {
  owner: Address
  token: Address
  spender: Address
  /** Max amount the spender can pull across the allowance window. Defaults to uint160 max. */
  amount?: bigint
  /** Allowance expiration as unix seconds. Defaults to now + 10 years. */
  expiration?: number
  /** Permit2 nonce for (owner, token, spender). Fetch with `getPermit2Nonce`. */
  nonce: number
  /** Signature deadline as unix seconds. Defaults to now + 1 hour. */
  sigDeadline?: bigint
  chainId: number
}

export function buildSubscribePermit(args: BuildSubscribePermitArgs): {
  permitSingle: PermitSingle
  typedData: {
    domain: { name: string; chainId: number; verifyingContract: Address }
    types: typeof permit2Types
    primaryType: 'PermitSingle'
    message: PermitSingle
  }
} {
  const now = Math.floor(Date.now() / 1000)
  const permitSingle: PermitSingle = {
    details: {
      token: args.token,
      amount: args.amount ?? MAX_UINT160,
      expiration: args.expiration ?? now + 10 * 365 * 24 * 60 * 60,
      nonce: args.nonce,
    },
    spender: args.spender,
    sigDeadline: args.sigDeadline ?? BigInt(now + 60 * 60),
  }

  return {
    permitSingle,
    typedData: {
      domain: {
        name: PERMIT2_DOMAIN_NAME,
        chainId: args.chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: permit2Types,
      primaryType: 'PermitSingle',
      message: permitSingle,
    },
  }
}

export async function signSubscribePermit(
  walletClient: WalletClient,
  account: Address,
  data: ReturnType<typeof buildSubscribePermit>['typedData'],
): Promise<`0x${string}`> {
  return walletClient.signTypedData({
    account,
    domain: data.domain,
    types: data.types,
    primaryType: data.primaryType,
    message: data.message,
  })
}
