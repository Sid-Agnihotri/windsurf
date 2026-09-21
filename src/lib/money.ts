/** Currency for event prices, deposits and tips (Stripe wants lowercase ISO codes). */
export const CURRENCY = "cad";

/** Format integer cents as Canadian dollars, e.g. "$12.00 CAD". */
export function formatMoney(cents: number, decimals = 2) {
  const amount = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(cents / 100);
  return `${amount} CAD`;
}

/** Service price still owed, excluding tips (amountPaidCents includes any tip). */
export function balanceDueCents(b: {
  totalCents: number;
  amountPaidCents: number;
  tipCents: number;
}) {
  return Math.max(0, b.totalCents - Math.max(0, b.amountPaidCents - b.tipCents));
}

/** Email line for what the guest still owes in person, or undefined if nothing. */
export function balanceNote(balanceCents: number) {
  return balanceCents > 0
    ? `${formatMoney(balanceCents)} is due in person at your appointment.`
    : undefined;
}
