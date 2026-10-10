/** Synthetic behavior fixtures only: no real authentication, payment, customer data, or AI calls. */
export interface LoginAttempt {
  cancelled: boolean;
  credentialsValid: boolean;
  accountEnabled: boolean;
}

function login(attempts: LoginAttempt[], rejectDisabled: boolean): string {
  for (const attempt of attempts.slice(0, 3)) {
    if (attempt.cancelled) return "cancelled";
    if (!attempt.credentialsValid) continue;
    if (rejectDisabled && !attempt.accountEnabled) return "disabled";
    return "signed-in";
  }
  return "attempts-exhausted";
}

/** Before the reference bug fix, valid credentials incorrectly admitted a disabled account. */
export function loginBefore(attempts: LoginAttempt[]): string { return login(attempts, false); }
export function loginAfter(attempts: LoginAttempt[]): string { return login(attempts, true); }

export function subscription(active: boolean): boolean { return active; }
export function eligibility(active: boolean): boolean { return subscription(active); }

export function discount(price: number, percent: number, active: boolean): number | null {
  if (!eligibility(active) || !Number.isInteger(percent) || percent < 0 || percent > 100) return null;
  return Math.round(price * (100 - percent) / 100);
}

export type GatewayResult = "pending" | "timeout" | "cancelled" | "declined" | "paid";
export interface PaymentInput {
  price: number;
  discountPercent?: number;
  activeSubscription: boolean;
  gatewayResults: GatewayResult[];
  verificationSucceeded: boolean;
}

function gateway(results: GatewayResult[], verified: boolean): string {
  for (const result of results) {
    if (result === "pending" || result === "timeout") continue;
    if (result === "cancelled") return "cancelled";
    if (result === "declined" || !verified) return "failed";
    return "paid";
  }
  return "waiting";
}

export function paymentBefore(input: PaymentInput): string {
  if (!Number.isSafeInteger(input.price) || input.price <= 0) return "invalid-price";
  return gateway(input.gatewayResults, input.verificationSucceeded);
}

export function paymentAfter(input: PaymentInput): string {
  if (!Number.isSafeInteger(input.price) || input.price <= 0) return "invalid-price";
  let due = input.price;
  if (input.discountPercent !== undefined) {
    const discounted = discount(input.price, input.discountPercent, input.activeSubscription);
    if (discounted === null) return "invalid-discount";
    due = discounted;
  }
  if (due === 0) return "free";
  return gateway(input.gatewayResults, input.verificationSucceeded);
}

export type ReplyResult = "pending" | "failed" | "ready";
export function chatBefore(active: boolean, result: Exclude<ReplyResult, "pending">): string {
  if (!subscription(active)) return "subscription-required";
  return result === "ready" ? "reply-delivered" : "failed";
}

/** The queue is an in-memory fixture input, not a deployed queue or a separate AI provider. */
export function chatAfter(active: boolean, jobResults: ReplyResult[]): string {
  if (!subscription(active)) return "subscription-required";
  for (const result of jobResults) {
    if (result === "pending") continue;
    return result === "ready" ? "reply-delivered" : "failed";
  }
  return "waiting";
}
