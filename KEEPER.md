# Keeper deployment

The Cadence Drip keeper is the actor that calls `charge(subId)` on due subscriptions, collects the keeper bounty, and keeps the protocol moving. Anyone can run one. This repo ships two ways to host it.

## Option A: Vercel function + external cron (free)

The endpoint `/api/keeper` lives in `web/api/keeper.ts` and is deployed alongside the frontend on Vercel. Vercel Hobby tier only allows a daily schedule, so the cron lives outside Vercel.

1. Generate a fresh wallet for the keeper (do not reuse the deployer).

   ```bash
   cast wallet new
   ```

2. Send the new wallet a small amount of USDC (a few dollars is enough; the bounty replenishes it).

3. In the Vercel project's Settings > Environment Variables, add:

   - `KEEPER_KEY` = the 0x prefixed private key from step 1
   - `CRON_SECRET` = any long random string

4. Redeploy. The endpoint is now live at `https://your-domain/api/keeper`.

5. Wire an external cron to hit it. Free options:

   - **cron-job.org** (free, web UI, schedules down to 1 minute): create job, URL = your endpoint, Header `Authorization: Bearer <CRON_SECRET>`.
   - **GitHub Actions** (free for public repos): add a workflow with `schedule: cron('*/5 * * * *')` that curls the endpoint.
   - **Upstash Schedules** (free tier).

To trigger manually for testing:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.vercel.app/api/keeper
```

If you upgrade Vercel to Pro ($20/mo), re-add the `crons` block to `web/vercel.json` and remove the external cron.

## Option B: long running Node process

For more frequent polling (every 30s, say), run `keeper/` as a normal Node service.

```bash
cd keeper
cp .env.example .env
# edit .env with KEEPER_KEY and SUBSCRIPTION_MANAGER
yarn dev
```

Deploy as a small VM (Fly.io, Railway, a Hetzner box), or as a long lived Cloudflare Worker with `setInterval`.

## What the keeper costs

Gas on Arc is paid in USDC. A `charge` transaction costs about $0.001 USDC. A 0.5% bounty on a 10 USDC plan is $0.05. Each successful charge nets the keeper roughly $0.049.

If your manager has dozens of active subscriptions, a single keeper wallet funds itself indefinitely. For the very first runs you need a few cents in the wallet to bootstrap.

## What the keeper does not do

- It does not retry failed charges in the same tick. If a sub is past due but the subscriber's USDC is empty, the call reverts and the keeper moves on. The next cron tick will try again.
- It does not back off per sub between ticks (Vercel option). The Node bot in `keeper/` does back off 10 minutes per failed sub.
- It does not index events. For analytics, run a separate watcher (template in `web/src/routes/docs.tsx`, indexer section).

## Verifying it works

After enabling, watch the Vercel function logs or the explorer for `Charged` events emitted by the manager. Or query the protocol fee balance:

```bash
cast call 0x3600000000000000000000000000000000000000 \
  "balanceOf(address)(uint256)" \
  0xE518ad6AD52cB5FF81C960CcA543B09F258e74b0 \
  --rpc-url https://rpc.testnet.arc.network
```

It should tick up by `0.5% * planAmount` per charge.
