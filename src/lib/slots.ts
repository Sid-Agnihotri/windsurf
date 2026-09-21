import {
  addMinutes,
  format,
  isBefore,
} from "date-fns";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import type {
  AvailabilityOverride,
  AvailabilityRule,
  Booking,
  HostSettings,
} from "@/db/schema";

export type TimeWindow = { startTime: string; endTime: string };

export type Slot = {
  start: Date;
  end: Date;
  /** ISO string for forms */
  startISO: string;
};

function parseHmOnDate(dateStr: string, hm: string, timeZone: string): Date {
  // Interpret HH:mm on YYYY-MM-DD in host TZ → UTC Date
  const local = `${dateStr} ${hm}:00`;
  return fromZonedTime(local, timeZone);
}

function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Generate bookable slots for a host+event on a calendar date (YYYY-MM-DD in host TZ).
 */
export function generateSlots(opts: {
  date: string; // YYYY-MM-DD host TZ
  durationMinutes: number;
  timeZone: string;
  rules: AvailabilityRule[];
  overrides: AvailabilityOverride[];
  settings: HostSettings;
  existingBookings: Pick<Booking, "startAt" | "endAt" | "status" | "expiresAt">[];
  now?: Date;
}): Slot[] {
  // A non-positive or non-finite duration would never advance the cursor below.
  if (!Number.isFinite(opts.durationMinutes) || opts.durationMinutes <= 0) {
    return [];
  }

  const now = opts.now ?? new Date();
  const override = opts.overrides.find((o) => o.date === opts.date);

  let windows: TimeWindow[] = [];
  if (override) {
    if (override.unavailable) return [];
    if (override.windowsJson) {
      try {
        const parsed: unknown = JSON.parse(override.windowsJson);
        windows = Array.isArray(parsed)
          ? parsed.filter(
              (w): w is TimeWindow =>
                typeof w?.startTime === "string" &&
                typeof w?.endTime === "string"
            )
          : [];
      } catch {
        windows = [];
      }
    }
  } else {
    // day of week in host TZ for that date
    const noonUtc = fromZonedTime(`${opts.date} 12:00:00`, opts.timeZone);
    const zoned = toZonedTime(noonUtc, opts.timeZone);
    const dow = zoned.getDay();
    windows = opts.rules
      .filter((r) => r.dayOfWeek === dow)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime }));
  }

  const minStart = addMinutes(now, opts.settings.minNoticeMinutes);
  const bufferBefore = opts.settings.bufferBeforeMinutes;
  const bufferAfter = opts.settings.bufferAfterMinutes;

  const activeBookings = opts.existingBookings.filter((b) => {
    if (b.status === "cancelled") return false;
    if (b.status === "pending_payment") {
      if (b.expiresAt && b.expiresAt < now) return false;
      return true;
    }
    return b.status === "confirmed" || b.status === "completed";
  });

  const slots: Slot[] = [];

  for (const w of windows) {
    let cursor = parseHmOnDate(opts.date, w.startTime, opts.timeZone);
    const windowEnd = parseHmOnDate(opts.date, w.endTime, opts.timeZone);

    // Invalid dates compare false against everything, which would loop forever.
    if (
      Number.isNaN(cursor.getTime()) ||
      Number.isNaN(windowEnd.getTime()) ||
      windowEnd <= cursor
    ) {
      continue;
    }

    while (true) {
      const slotEnd = addMinutes(cursor, opts.durationMinutes);
      if (slotEnd > windowEnd) break;

      const blockedStart = addMinutes(cursor, -bufferBefore);
      const blockedEnd = addMinutes(slotEnd, bufferAfter);

      const tooSoon = isBefore(cursor, minStart);
      const conflict = activeBookings.some((b) =>
        overlaps(blockedStart, blockedEnd, b.startAt, b.endAt)
      );

      if (!tooSoon && !conflict) {
        slots.push({
          start: cursor,
          end: slotEnd,
          startISO: cursor.toISOString(),
        });
      }

      cursor = addMinutes(cursor, opts.durationMinutes);
      // Also step by duration; buffers applied only for conflict, not stepping
    }
  }

  return slots;
}

export function formatSlotLabel(iso: string, timeZone: string) {
  return formatInTimeZone(new Date(iso), timeZone, "h:mm a");
}

export function monthBoundsUtc(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end };
}

// re-export helpers used by pages
export { formatInTimeZone, format };
