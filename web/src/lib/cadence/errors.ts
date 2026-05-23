/**
 * Map common viem / wallet errors to short, user-friendly strings.
 * Falls back to the first line of the error message when nothing matches.
 */
export function humanizeError(err: unknown): string {
  const raw =
    (err as { shortMessage?: string })?.shortMessage ||
    (err instanceof Error ? err.message : String(err));
  const s = raw.toLowerCase();

  if (s.includes("user rejected") || s.includes("user denied"))
    return "Signature rejected in wallet.";
  if (s.includes("insufficient funds"))
    return "Wallet does not have enough USDC for gas. Top up via the testnet faucet.";
  if (s.includes("insufficient allowance"))
    return "Permit2 allowance is exhausted. Subscribe again to refresh it.";
  if (s.includes("transfer amount exceeds balance"))
    return "Subscriber USDC balance is too low for this charge.";

  if (s.includes("notdue") || s.includes("not due"))
    return "This subscription is not due yet.";
  if (s.includes("alreadycancelled") || s.includes("already cancelled"))
    return "This subscription is already cancelled.";
  if (s.includes("planinactive") || s.includes("plan inactive"))
    return "This plan has been deactivated by the merchant.";
  if (s.includes("notsubscriber") || s.includes("not subscriber"))
    return "Only the original subscriber can cancel this subscription.";
  if (s.includes("notmerchant") || s.includes("not merchant"))
    return "Only the merchant who created this plan can deactivate it.";

  if (s.includes("invalidamount") || s.includes("invalid amount"))
    return "Amount must be greater than zero.";
  if (s.includes("periodtoshort") || s.includes("period too short"))
    return "Period must be at least 1 hour.";
  if (s.includes("bountytoohigh") || s.includes("bounty too high"))
    return "Bounty must not exceed 10%.";
  if (s.includes("invalidfeerecipient"))
    return "Protocol fee recipient cannot be the zero address.";

  if (s.includes("chain") && s.includes("mismatch"))
    return "Switch your wallet to Arc Testnet.";
  if (s.includes("contract function") && s.includes("returned no data"))
    return "RPC unreachable or contract not found. Try again in a moment.";

  return raw.split("\n")[0];
}
