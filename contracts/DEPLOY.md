# Deploying to Arc Testnet

Chain ID: `5042002`. RPC: `https://rpc.testnet.arc.network`. Explorer: https://testnet.arcscan.app

## One-time setup

1. Create a fresh deployer wallet (do not reuse a mainnet key).
2. Fund it from the Arc testnet faucet. A few USDC for gas is enough; the contract is small.
3. Export the key:
   ```bash
   cp .env.example .env
   # edit .env and paste your DEPLOYER_KEY
   ```

## Deploy

From `contracts/`:

```bash
source .env
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$ARC_TESTNET_RPC" \
  --broadcast \
  -vvv
```

The script prints the deployed `SubscriptionManager` address. Copy it into `packages/sdk/src/chains.ts` under `cadenceDeployments[5042002]`.

## Verify on ArcScan

```bash
forge verify-contract \
  --rpc-url "$ARC_TESTNET_RPC" \
  --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api/ \
  <DEPLOYED_ADDRESS> \
  src/SubscriptionManager.sol:SubscriptionManager \
  --constructor-args $(cast abi-encode "constructor(address)" 0x000000000022D473030F116dDEE9F6B43aC78BA3)
```

## After deploy

- Update `packages/sdk/src/chains.ts` with the address.
- Rebuild SDK: `yarn workspace @cadence/sdk build`.
- The web app and keeper will pick it up automatically.
