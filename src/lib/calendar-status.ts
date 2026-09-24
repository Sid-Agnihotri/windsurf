import { and, count, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { account, booking, hostSettings, type CalendarProvider } from "@/db/schema";
import { accessToken, findConnection } from "@/lib/calendar";
import {
  configuredProviders,
  hasCalendarScope,
  isCalendarProvider,
} from "@/lib/social-providers";

export type CalendarStatus =
  /** Neither Google nor Microsoft is set up on this server, so there's nothing to connect. */
  | { state: "unavailable" }
  | { state: "not_linked"; providers: CalendarProvider[] }
  /** Signed in with the provider, but skipped the calendar permission. */
  | { state: "no_access"; provider: CalendarProvider }
  /** Connected, but the host paused calendar sync. */
  | { state: "paused"; provider: CalendarProvider }
  /** Connected on paper, but Google/Microsoft won't give us a token (revoked or expired). */
  | { state: "broken"; provider: CalendarProvider }
  /** Working. `missing` = upcoming confirmed bookings that aren't on the calendar. */
  | { state: "connected"; provider: CalendarProvider; missing: number };

const TOKEN_CHECK_MS = 5000;

/** Whether we can currently get an access token, refreshing an expired one along the way. */
async function canGetToken(conn: NonNullable<Awaited<ReturnType<typeof findConnection>>>) {
  try {
    await Promise.race([
      accessToken(conn),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("token check timed out")), TOKEN_CHECK_MS)
      ),
    ]);
    return true;
  } catch (err) {
    console.error("Calendar connection check failed", err);
    return false;
  }
}

/** Upcoming confirmed bookings with no event on the host's calendar. */
export async function countUnsyncedBookings(hostId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(booking)
    .where(
      and(
        eq(booking.hostId, hostId),
        eq(booking.status, "confirmed"),
        gte(booking.startAt, new Date()),
        isNull(booking.calendarEventId)
      )
    );
  return Number(row?.n ?? 0);
}

/** A live read on the host's calendar connection, for the dashboard's health card. */
export async function getCalendarStatus(hostId: string): Promise<CalendarStatus> {
  const configured = configuredProviders();
  if (configured.length === 0) return { state: "unavailable" };

  const linked = (await db.select().from(account).where(eq(account.userId, hostId))).filter(
    (a) => isCalendarProvider(a.providerId) && configured.includes(a.providerId)
  );
  const withCalendar = linked.filter((a) =>
    hasCalendarScope(a.providerId as CalendarProvider, a.scope)
  );

  if (linked.length === 0) return { state: "not_linked", providers: configured };
  if (withCalendar.length === 0) {
    return { state: "no_access", provider: linked[0].providerId as CalendarProvider };
  }

  const [settings] = await db
    .select({ choice: hostSettings.calendarProvider })
    .from(hostSettings)
    .where(eq(hostSettings.hostId, hostId))
    .limit(1);
  if (settings?.choice === "off") {
    return { state: "paused", provider: withCalendar[0].providerId as CalendarProvider };
  }

  const conn = await findConnection(hostId);
  if (!conn) return { state: "no_access", provider: linked[0].providerId as CalendarProvider };
  if (!(await canGetToken(conn))) return { state: "broken", provider: conn.provider };

  return {
    state: "connected",
    provider: conn.provider,
    missing: await countUnsyncedBookings(hostId),
  };
}
