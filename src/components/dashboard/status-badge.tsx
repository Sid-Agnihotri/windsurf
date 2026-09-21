import type { BookingStatus } from "@/db/schema";
import { balanceDueCents, formatMoney } from "@/lib/money";

type Tone = "green" | "amber" | "red" | "blue" | "slate";

const TONES: Record<Tone, string> = {
  green: "border-green-200 bg-green-100 text-green-800",
  amber: "border-amber-200 bg-amber-100 text-amber-800",
  red: "border-red-200 bg-red-100 text-red-800",
  blue: "border-blue-200 bg-blue-100 text-blue-800",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
};

/** A small colored label with a status dot. */
export function StatusPill({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

const BOOKING: Record<BookingStatus, { tone: Tone; label: string }> = {
  confirmed: { tone: "green", label: "Confirmed" },
  pending_payment: { tone: "amber", label: "Pending payment" },
  cancelled: { tone: "red", label: "Cancelled" },
  completed: { tone: "blue", label: "Completed" },
};

export function BookingStatusBadge({ status }: { status: string }) {
  const s = BOOKING[status as BookingStatus] ?? {
    tone: "slate" as Tone,
    label: status.replace("_", " "),
  };
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
}

/** Paid / balance-due label for a booking; nothing for free, cancelled or unpaid-online bookings. */
export function PaymentBadge(b: {
  status: string;
  totalCents: number;
  amountPaidCents: number;
  tipCents: number;
}) {
  if (b.status !== "confirmed" && b.status !== "completed") return null;
  const balance = balanceDueCents(b);
  if (balance > 0) {
    return <StatusPill tone="amber">Balance due {formatMoney(balance)}</StatusPill>;
  }
  if (b.totalCents > 0 || b.amountPaidCents > 0) {
    return <StatusPill tone="green">Paid</StatusPill>;
  }
  return null;
}
