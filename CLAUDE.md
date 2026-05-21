# Cadence — project notes for Claude

## What this is

Recurring USDC subscriptions on Arc Network. Customer grants a Permit2 allowance once; a permissionless contract pulls payment on cadence (default monthly). Cancel = single tx. Keeper bounty is paid from each charge, so anyone can run a keeper without losing money.

## Hard rules specific to this repo

- Solidity 0.8.30, Foundry. OpenZeppelin v5.
- Use canonical Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`). Do not embed Permit2 source; just the interface.
- Use `AllowanceTransfer` mode of Permit2, never `SignatureTransfer`. Subscriptions need reusable allowances.
- All TS code uses viem (not ethers). Wagmi v2 + RainbowKit on the web side.
- Never `--no-verify` git hooks. Never amend pushed commits.
- Package manager is yarn 4 (node-modules linker). SDK distributed via `github:trevor00s/cadence#path:packages/sdk`, not the npm registry.

## Invariants in the contract

- `nextCharge` is advanced **before** the external `transferFrom` call (reentrancy + same-block double-charge protection).
- Anyone may call `charge(subId)` if the sub is due and not cancelled and the plan is active. The caller receives `bountyBps` of the charge.
- A subscriber can always cancel. A merchant can deactivate a plan, which stops future charges across every subscription on that plan.
- Charges are calendar-based: `next = previousNext + period`. A subscriber who missed N periods can be "caught up" by N successive `charge` calls. This is intentional.

## Open questions to revisit

- Failed-charge UX: do we add a `missedCharges` counter and auto-cancel after N? Currently no.
- Variable amounts (metered billing): out of scope for v1.
- Plan metadata (name, description) lives off-chain in v1.
