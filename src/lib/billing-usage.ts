import { and, count, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { booking, eventType } from "@/db/schema";
import { monthBoundsUtc } from "@/lib/slots";

/** How much of the plan's limits a host has used, counted the same way the limits are enforced. */
export async function getPlanUsage(hostId: string) {
  const { start, end } = monthBoundsUtc();
  const [[events], [bookings]] = await Promise.all([
    db.select({ n: count() }).from(eventType).where(eq(eventType.hostId, hostId)),
    db
      .select({ n: count() })
      .from(booking)
      .where(
        and(
          eq(booking.hostId, hostId),
          gte(booking.createdAt, start),
          lt(booking.createdAt, end),
          ne(booking.status, "cancelled")
        )
      ),
  ]);
  return { events: Number(events?.n ?? 0), bookingsThisMonth: Number(bookings?.n ?? 0) };
}
