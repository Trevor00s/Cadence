export const subscriptionManagerAbi = [
  {
    type: 'function',
    name: 'createPlan',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'period', type: 'uint48' },
      { name: 'bountyBps', type: 'uint16' },
    ],
    outputs: [{ name: 'planId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'deactivatePlan',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'planId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'subscribe',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'planId', type: 'uint256' },
      {
        name: 'permitSingle',
        type: 'tuple',
        components: [
          {
            name: 'details',
            type: 'tuple',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint160' },
              { name: 'expiration', type: 'uint48' },
              { name: 'nonce', type: 'uint48' },
            ],
          },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'subId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'subscribeWithExistingAllowance',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'planId', type: 'uint256' }],
    outputs: [{ name: 'subId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'charge',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancel',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'nextPlanId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextSubId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isDue',
    stateMutability: 'view',
    inputs: [{ name: 'subId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'plans',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'merchant', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'period', type: 'uint48' },
      { name: 'bountyBps', type: 'uint16' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'subscriptions',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'planId', type: 'uint256' },
      { name: 'subscriber', type: 'address' },
      { name: 'nextCharge', type: 'uint48' },
      { name: 'createdAt', type: 'uint48' },
      { name: 'cancelled', type: 'bool' },
    ],
  },
] as const

export const permit2Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
  },
] as const

export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const
