"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { booking } from "@/db/schema";
import { calendarBusyForMove, listMoveSlots, moveBooking } from "@/lib/reschedule";
import { removeBookingFromCalendar, syncBookingToCalendar } from "@/lib/calendar";
import { loadHostSettings } from "@/lib/availability-data";
import { findBookingByToken } from "@/lib/booking-by-token";
import {
  guestChangeState,
  manageUrl,
  type GuestChangeState,
} from "@/lib/manage";
import { sendBookingCancelled, sendBookingRescheduled } from "@/lib/email";
import { formatMoney } from "@/lib/money";
import { getStripe } from "@/lib/stripe";

/**
 * Guest self-service. There is no login: the secret `manageToken` in the
 * guest's link is the only credential, so every failure for an unknown token
 * is the same generic message.
 */

const INVALID = "This link isn't valid.";
const WHEN = "EEE, MMM d yyyy 'at' h:mm a zzz";

function blockedMessage(
  state: Exclude<GuestChangeState, "ok">,
  hostName: string,
  changeNoticeHours: number
) {
  switch (state) {
    case "cancelled":
      return "This booking was already cancelled.";
    case "past":
      return "This appointment has already passed.";
    case "pending_payment":
      return "This booking is waiting for payment, so it can only be cancelled.";
    case "too_late":
      return `Changes are closed within ${changeNoticeHours} hour${changeNoticeHours === 1 ? "" : "s"} of the appointment. Please contact ${hostName}.`;
  }
}

export async function cancelByGuest(token: string) {
  const row = findBookingByToken(db, token);
  if (!row) return { error: INVALID };
  const { booking: b, evt, host } = row;

  const settings = loadHostSettings(db, host.id);
  const state = guestChangeState({
    status: b.status,
    startAt: b.startAt,
    changeNoticeHours: settings.changeNoticeHours,
  });
  if (state === "cancelled") return { ok: true };
  // A booking still waiting for payment can always be cancelled.
  if (state !== "ok" && state !== "pending_payment") {
    return { error: blockedMessage(state, host.name, settings.changeNoticeHours) };
  }

  const updated = await db
    .update(booking)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(booking.id, b.id), ne(booking.status, "cancelled")))
    .returning({ id: booking.id });
  if (updated.length === 0) return { ok: true };
  await removeBookingFromCalendar(b.id);

  // Stop an unpaid Stripe Checkout from being completed after cancelling.
  const stripe = getStripe();
  if (
    stripe &&
    b.status === "pending_payment" &&
    b.stripeCheckoutSessionId &&
    !b.stripeCheckoutSessionId.startsWith("mock_")
  ) {
    try {
      await stripe.checkout.sessions.expire(b.stripeCheckoutSessionId);
    } catch (err) {
      console.error("Could not expire checkout session", err);
    }
  }

  const paid = b.amountPaidCents;
  await sendBookingCancelled({
    guestEmail: b.guestEmail,
    guestName: b.guestName,
    hostEmail: host.email,
    hostName: host.name,
    eventTitle: evt.title,
    whenLabel: formatInTimeZone(b.startAt, host.timezone, WHEN),
    cancelledBy: "guest",
    guestNote:
      paid > 0
        ? `You paid ${formatMoney(paid)}. Refunds are handled by ${host.name}, so please contact them.`
        : undefined,
    hostNote:
      paid > 0
        ? `The guest paid ${formatMoney(paid)}. Refund it from Stripe or in person.`
        : undefined,
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Open slots this booking could move to on `date` (YYYY-MM-DD in the host's timezone). */
export async function getRescheduleSlots(token: string, date: string) {
  const none = [] as { startISO: string }[];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date.", slots: none };
  const found = findBookingByToken(db, token);
  if (!found) return { error: INVALID, slots: none };
  const { booking: b, host } = found;

  const settings = loadHostSettings(db, host.id);
  const state = guestChangeState({
    status: b.status,
    startAt: b.startAt,
    changeNoticeHours: settings.changeNoticeHours,
  });
  if (state !== "ok") {
    return {
      error: blockedMessage(state, host.name, settings.changeNoticeHours),
      slots: none,
    };
  }

  return {
    slots: listMoveSlots(found, date, await calendarBusyForMove(found, date)).map(
      (s) => ({ startISO: s.startISO })
    ),
    timeZone: host.timezone,
  };
}

export async function rescheduleByGuest(token: string, startISO: string) {
  const startAt = new Date(startISO);
  if (Number.isNaN(startAt.getTime())) return { error: "Invalid time." };

  // Find the booking first: the calendar has to be read before the (synchronous) move.
  const current = findBookingByToken(db, token);
  const externalBusy = current
    ? await calendarBusyForMove(
        current,
        formatInTimeZone(startAt, current.host.timezone, "yyyy-MM-dd")
      )
    : undefined;

  const outcome = moveBooking({
    startAt,
    externalBusy,
    notFoundMessage: INVALID,
    find: (q) => findBookingByToken(q, token),
    blocked: ({ booking: b, host }, settings) => {
      const state = guestChangeState({
        status: b.status,
        startAt: b.startAt,
        changeNoticeHours: settings.changeNoticeHours,
      });
      return state === "ok"
        ? null
        : blockedMessage(state, host.name, settings.changeNoticeHours);
    },
  });
  if ("error" in outcome) return { error: outcome.error };

  const { booking: b, evt, host } = outcome.found;
  await syncBookingToCalendar(b.id);
  await sendBookingRescheduled({
    guestEmail: b.guestEmail,
    guestName: b.guestName,
    hostEmail: host.email,
    hostName: host.name,
    eventTitle: evt.title,
    oldWhenLabel: formatInTimeZone(b.startAt, host.timezone, WHEN),
    whenLabel: formatInTimeZone(startAt, host.timezone, WHEN),
    movedBy: "guest",
    manageUrl: b.manageToken ? manageUrl(b.manageToken) : undefined,
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  return { ok: true };
}
