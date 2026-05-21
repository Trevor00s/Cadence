import { ARC_TESTNET } from "./chain";

export const PERMIT2_DOMAIN = {
  name: "Permit2",
  chainId: ARC_TESTNET.id,
  verifyingContract: ARC_TESTNET.permit2,
} as const;

export const PERMIT2_TYPES = {
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
} as const;

// uint160 max
export const MAX_UINT160 = (1n << 160n) - 1n;
// 10 years from now (uint48)
export const expirationDefault = () =>
  Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10;
// 1h signature deadline
export const sigDeadlineDefault = () =>
  BigInt(Math.floor(Date.now() / 1000) + 60 * 60);

export function shortAddr(a?: string) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function periodLabel(seconds: number) {
  const day = 86400;
  if (seconds % (365 * day) === 0) return `${seconds / (365 * day)}y`;
  if (seconds % (30 * day) === 0) return `${seconds / (30 * day)}mo`;
  if (seconds % (7 * day) === 0) return `${seconds / (7 * day)}w`;
  if (seconds % day === 0) return `${seconds / day}d`;
  return `${seconds}s`;
}

export function periodLong(seconds: number) {
  const day = 86400;
  if (seconds === 365 * day) return "every year";
  if (seconds === 30 * day) return "every 30 days";
  if (seconds === 7 * day) return "every 7 days";
  if (seconds === day) return "every day";
  return `every ${seconds}s`;
}

export function formatUsdc(raw: bigint) {
  // USDC has 6 decimals
  const whole = raw / 1_000_000n;
  const frac = raw % 1_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

export function parseUsdc(input: string): bigint {
  const [w, f = ""] = input.trim().split(".");
  const frac = (f + "000000").slice(0, 6);
  return BigInt(w || "0") * 1_000_000n + BigInt(frac || "0");
}

export function relativeTime(unix: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = unix - now;
  const abs = Math.abs(diff);
  const day = 86400;
  if (abs < 60) return diff >= 0 ? "in <1m" : "<1m ago";
  if (abs < 3600)
    return diff >= 0 ? `in ${Math.round(abs / 60)}m` : `${Math.round(abs / 60)}m ago`;
  if (abs < day)
    return diff >= 0
      ? `in ${Math.round(abs / 3600)}h`
      : `${Math.round(abs / 3600)}h ago`;
  return diff >= 0
    ? `in ${Math.round(abs / day)}d`
    : `${Math.round(abs / day)}d ago`;
}
