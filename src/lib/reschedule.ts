import { addMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  booking,
  type Booking,
  type EventType,
  type HostSettings,
  type User,
} from "@/db/schema";
import { generateSlots, type BusyInterval } from "@/lib/slots";
import { busyForDate } from "@/lib/calendar";
import { loadAvailability, type Queryable } from "@/lib/availability-data";

export type FoundBooking = { booking: Booking; evt: EventType; host: User };

export type MoveResult =
  | { error: string }
  | { ok: true; found: FoundBooking };

/**
 * Moves a booking to `startAt` if that time is open, in one IMMEDIATE
 * transaction so two people can't take the same slot (better-sqlite3 is
 * synchronous, so nothing in here may await). Shared by the guest's manage
 * link and the host's dashboard; each supplies how to find the booking and
 * when it may not be moved.
 */
export function moveBooking(opts: {
  startAt: Date;
  /** The host's calendar busy times around the new date, fetched beforehand (this can't await). */
  externalBusy?: BusyInterval[];
  notFoundMessage: string;
  find: (q: Queryable) => FoundBooking | undefined;
  /** An error message if this booking can't be moved right now, else null. */
  blocked: (found: FoundBooking, settings: HostSettings) => string | null;
}): MoveResult {
  return db.transaction(
    (tx) => {
      const found = opts.find(tx);
      if (!found) return { error: opts.notFoundMessage } as const;
      const { booking: b, evt, host } = found;

      // The booking itself is excluded so its own old time doesn't block the move.
      const { settings, rules, overrides, existing } = loadAvailability(
        tx,
        host.id,
        b.id
      );
      const message = opts.blocked(found, settings);
      if (message) return { error: message } as const;
      if (opts.startAt.getTime() === b.startAt.getTime()) {
        return { error: "That's already the booking time." } as const;
      }

      const slots = generateSlots({
        date: formatInTimeZone(opts.startAt, host.timezone, "yyyy-MM-dd"),
        durationMinutes: evt.durationMinutes,
        timeZone: host.timezone,
        rules,
        overrides,
        settings,
        existingBookings: existing,
        externalBusy: opts.externalBusy,
      });
      if (!slots.some((s) => s.startISO === opts.startAt.toISOString())) {
        return { error: "That time is no longer available. Pick another." } as const;
      }

      tx.update(booking)
        .set({
          startAt: opts.startAt,
          endAt: addMinutes(opts.startAt, evt.durationMinutes),
          updatedAt: new Date(),
        })
        .where(eq(booking.id, b.id))
        .run();
      return { ok: true, found } as const;
    },
    { behavior: "immediate" }
  );
}

/**
 * The host's calendar busy times around `date`, for a booking being moved there.
 * The booking's own calendar event is left out so it doesn't block its own new time.
 */
export function calendarBusyForMove(found: FoundBooking, date: string) {
  return busyForDate({
    hostId: found.host.id,
    date,
    timeZone: found.host.timezone,
    excludeEventId: found.booking.calendarEventId,
  });
}

/** Open times this booking could move to on `date` (YYYY-MM-DD in the host's timezone). */
export function listMoveSlots(
  found: FoundBooking,
  date: string,
  externalBusy?: BusyInterval[]
) {
  const { booking: b, evt, host } = found;
  const { settings, rules, overrides, existing } = loadAvailability(
    db,
    host.id,
    b.id
  );
  return generateSlots({
    date,
    durationMinutes: evt.durationMinutes,
    timeZone: host.timezone,
    rules,
    overrides,
    settings,
    existingBookings: existing,
    externalBusy,
  });
}
