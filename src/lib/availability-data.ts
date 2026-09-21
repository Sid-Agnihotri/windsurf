import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  availabilityOverride,
  availabilityRule,
  booking,
  hostSettings,
  type HostSettings,
} from "@/db/schema";

/** Either `db` or a transaction handle: both run better-sqlite3 queries synchronously. */
export type Queryable = Pick<typeof db, "select">;

/** Used when a host has no settings row yet. */
export function defaultHostSettings(hostId: string): HostSettings {
  return {
    hostId,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minNoticeMinutes: 120,
    changeNoticeHours: 24,
  };
}

/** The host's scheduling settings, or defaults if none are saved yet. */
export function loadHostSettings(q: Queryable, hostId: string): HostSettings {
  return (
    q
      .select()
      .from(hostSettings)
      .where(eq(hostSettings.hostId, hostId))
      .limit(1)
      .get() ?? defaultHostSettings(hostId)
  );
}

/**
 * Everything `generateSlots` needs for a host. Pass `excludeBookingId` when
 * rescheduling so a booking doesn't block its own new time.
 * Synchronous, so it can run inside `db.transaction`.
 */
export function loadAvailability(
  q: Queryable,
  hostId: string,
  excludeBookingId?: string
) {
  const settings = loadHostSettings(q, hostId);
  const rules = q
    .select()
    .from(availabilityRule)
    .where(eq(availabilityRule.hostId, hostId))
    .all();
  const overrides = q
    .select()
    .from(availabilityOverride)
    .where(eq(availabilityOverride.hostId, hostId))
    .all();
  const existing = q
    .select()
    .from(booking)
    .where(eq(booking.hostId, hostId))
    .all()
    .filter((b) => b.id !== excludeBookingId);

  return { settings, rules, overrides, existing };
}
