# Cadence Drip

Recurring USDC subscriptions on Arc.

A merchant defines a plan (amount, period). A customer signs a single Permit2 allowance. Renewals execute automatically, on-chain, with no further signatures. Cancellation is a single transaction.

## Why this exists

Stripe Billing runs on rails the merchant does not control. Cards expire, banks decline, currencies fragment, and every recurring charge is mediated by a processor that can shut you off. Cadence Drip replaces the trust assumptions with on-chain primitives: the allowance is granted by the customer to a public contract, the charge is verifiable by anyone, and the merchant settles in USDC instantly.

On Arc, gas is paid in USDC, so renewals do not require the customer to hold a native gas token. A keeper can call `charge` for any due subscription and is reimbursed atomically from the same payment, in the same currency.

## Architecture

- `contracts/` Foundry. `SubscriptionManager` holds plans and subscriptions; pulls funds via canonical Permit2.
- `packages/sdk/` TypeScript SDK for merchants and customers. Built on viem.
- `web/` Demo merchant dashboard and customer checkout widget.
- `keeper/` Reference keeper bot. Permissionless; anyone can run one.

## Status

Pre-production. Contracts unaudited. Do not use with funds you cannot afford to lose.
