import { eq } from "drizzle-orm";
import { booking, eventType, user } from "@/db/schema";
import type { Queryable } from "@/lib/availability-data";

/**
 * The booking behind a guest's manage link, with its event and host.
 * Synchronous, so it works with `db` or inside a transaction.
 */
export function findBookingByToken(q: Queryable, token: string) {
  // Cheap guard: real tokens are 32 characters.
  if (!token || token.length < 20) return undefined;
  return q
    .select({ booking, evt: eventType, host: user })
    .from(booking)
    .innerJoin(eventType, eq(booking.eventTypeId, eventType.id))
    .innerJoin(user, eq(booking.hostId, user.id))
    .where(eq(booking.manageToken, token))
    .get();
}
