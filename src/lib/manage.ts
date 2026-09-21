import type { BookingStatus } from "@/db/schema";
import { appUrl } from "@/lib/stripe";

/** The link guests use to cancel or reschedule their booking. */
export function manageUrl(token: string) {
  return `${appUrl()}/booking/manage/${token}`;
}

export type GuestChangeState =
  | "ok"
  | "cancelled"
  | "past"
  | "pending_payment"
  | "too_late";

/**
 * What a guest may do with their booking right now.
 * - ok: cancel or reschedule
 * - pending_payment: cancel only (payment not completed yet)
 * - cancelled / past / too_late: nothing (too_late = inside the host's cutoff window)
 * Changes are allowed up to and including `changeNoticeHours` before the start; 0 means until it starts.
 */
export function guestChangeState(opts: {
  status: BookingStatus;
  startAt: Date;
  changeNoticeHours: number;
  now?: Date;
}): GuestChangeState {
  const now = opts.now ?? new Date();
  if (opts.status === "cancelled") return "cancelled";
  if (opts.status === "completed" || opts.startAt <= now) return "past";
  if (opts.status === "pending_payment") return "pending_payment";

  const cutoff = opts.startAt.getTime() - opts.changeNoticeHours * 60 * 60 * 1000;
  return now.getTime() > cutoff ? "too_late" : "ok";
}
