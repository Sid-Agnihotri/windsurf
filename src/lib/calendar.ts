import { addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  account,
  booking,
  eventType,
  hostSettings,
  user,
  type CalendarProvider,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import type { BusyInterval } from "@/lib/slots";
import { hasCalendarScope, isCalendarProvider } from "@/lib/social-providers";

/**
 * Two-way sync with the host's Google or Outlook calendar: their existing events block
 * booking slots, and each confirmed booking is added to the calendar (and moved or removed
 * with it). The calendar is a convenience, so nothing here may break a booking: every
 * exported function logs and swallows failures instead of throwing.
 */

const GOOGLE = "https://www.googleapis.com/calendar/v3/calendars/primary";
const GRAPH = "https://graph.microsoft.com/v1.0/me";
const TIMEOUT_MS = 8000;
const MAX_PAGES = 5;

export type Connection = { provider: CalendarProvider; accountId: string; userId: string };

/** Which of the host's linked accounts to use, honouring their choice in Settings. */
export async function findConnection(
  hostId: string,
  forceProvider?: CalendarProvider
): Promise<Connection | null> {
  const [settings] = await db
    .select({ calendarProvider: hostSettings.calendarProvider })
    .from(hostSettings)
    .where(eq(hostSettings.hostId, hostId))
    .limit(1);
  const choice = settings?.calendarProvider ?? null;
  if (!forceProvider && choice === "off") return null;

  const accounts = await db.select().from(account).where(eq(account.userId, hostId));
  const usable = accounts.filter(
    (a) =>
      isCalendarProvider(a.providerId) && hasCalendarScope(a.providerId, a.scope)
  );
  // An existing event must stay on its own calendar; a stale choice (say the chosen
  // account was unlinked) falls back to whatever is still connected.
  const pick = forceProvider
    ? usable.find((a) => a.providerId === forceProvider)
    : (choice && choice !== "off"
        ? usable.find((a) => a.providerId === choice)
        : undefined) ?? usable[0];
  if (!pick) return null;
  return {
    provider: pick.providerId as CalendarProvider,
    accountId: pick.id,
    userId: hostId,
  };
}

/** A current access token, refreshed by Better Auth when it has expired. */
export async function accessToken(conn: Connection) {
  const tokens = await auth.api.getAccessToken({
    body: { accountId: conn.accountId, userId: conn.userId },
  });
  // With no refresh token (Google only issues one on consent), an expired token comes back
  // as-is. It would only earn a 401, so report the connection as lost instead.
  if (
    tokens.accessTokenExpiresAt &&
    new Date(tokens.accessTokenExpiresAt).getTime() <= Date.now()
  ) {
    throw new Error("Calendar access token expired and could not be refreshed");
  }
  return tokens.accessToken;
}

async function call(
  token: string,
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return res;
}

async function failure(what: string, res: Response) {
  const detail = (await res.text().catch(() => "")).slice(0, 300);
  return new Error(`${what} failed: ${res.status} ${detail}`);
}

// ——— Reading busy time ———

type GoogleEvent = {
  id?: string;
  status?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
};

/** Turns Google events into busy intervals, skipping free, cancelled and declined ones. */
export function googleBusy(
  events: GoogleEvent[],
  timeZone: string,
  excludeEventId?: string
): BusyInterval[] {
  const out: BusyInterval[] = [];
  for (const e of events) {
    if (e.id && e.id === excludeEventId) continue;
    if (e.status === "cancelled" || e.transparency === "transparent") continue;
    if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
    const start = e.start?.dateTime
      ? new Date(e.start.dateTime)
      : e.start?.date
        ? fromZonedTime(`${e.start.date} 00:00:00`, timeZone)
        : null;
    const end = e.end?.dateTime
      ? new Date(e.end.dateTime)
      : e.end?.date
        ? fromZonedTime(`${e.end.date} 00:00:00`, timeZone)
        : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    out.push({ start, end });
  }
  return out;
}

type GraphEvent = {
  id?: string;
  isCancelled?: boolean;
  isAllDay?: boolean;
  showAs?: string;
  responseStatus?: { response?: string };
  start?: { dateTime?: string };
  end?: { dateTime?: string };
};

/** Graph returns UTC times without a zone marker and with 7 fractional digits. */
function graphDate(dateTime: string | undefined) {
  if (!dateTime) return null;
  const d = new Date(`${dateTime.replace(/(\.\d{3})\d+$/, "$1")}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Turns Outlook events into busy intervals, skipping free, cancelled and declined ones. */
export function graphBusy(
  events: GraphEvent[],
  timeZone: string,
  excludeEventId?: string
): BusyInterval[] {
  const out: BusyInterval[] = [];
  for (const e of events) {
    if (e.id && e.id === excludeEventId) continue;
    if (e.isCancelled || e.responseStatus?.response === "declined") continue;
    if (e.showAs === "free" || e.showAs === "workingElsewhere") continue;
    let start: Date | null;
    let end: Date | null;
    if (e.isAllDay) {
      // All-day events are dates, not instants: read them as whole days in the host's zone.
      const s = e.start?.dateTime?.slice(0, 10);
      const en = e.end?.dateTime?.slice(0, 10);
      start = s ? fromZonedTime(`${s} 00:00:00`, timeZone) : null;
      end = en ? fromZonedTime(`${en} 00:00:00`, timeZone) : null;
    } else {
      start = graphDate(e.start?.dateTime);
      end = graphDate(e.end?.dateTime);
    }
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    out.push({ start, end });
  }
  return out;
}

async function fetchGoogleBusy(
  token: string,
  from: Date,
  to: Date,
  timeZone: string,
  excludeEventId?: string
) {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: "true",
      maxResults: "250",
      fields:
        "nextPageToken,items(id,status,transparency,start,end,attendees(self,responseStatus))",
    });
    if (pageToken) qs.set("pageToken", pageToken);
    const res = await call(token, `${GOOGLE}/events?${qs}`);
    if (!res.ok) throw await failure("Google events list", res);
    const data = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string };
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return googleBusy(events, timeZone, excludeEventId);
}

async function fetchGraphBusy(
  token: string,
  from: Date,
  to: Date,
  timeZone: string,
  excludeEventId?: string
) {
  const events: GraphEvent[] = [];
  const select = "id,start,end,showAs,isCancelled,isAllDay,responseStatus";
  let url: string | undefined =
    `${GRAPH}/calendarView?startDateTime=${encodeURIComponent(from.toISOString())}` +
    `&endDateTime=${encodeURIComponent(to.toISOString())}&$select=${select}&$top=100`;
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res = await call(token, url, { headers: { Prefer: 'outlook.timezone="UTC"' } });
    if (!res.ok) throw await failure("Outlook calendarView", res);
    const data = (await res.json()) as { value?: GraphEvent[]; "@odata.nextLink"?: string };
    events.push(...(data.value ?? []));
    url = data["@odata.nextLink"];
  }
  return graphBusy(events, timeZone, excludeEventId);
}

/**
 * The host's busy periods around `date` (YYYY-MM-DD in their timezone), from their calendar.
 * A day either side is included so buffers and late-night slots see neighbouring events.
 * Returns [] when no calendar is connected or it can't be reached: better to offer a slot
 * that might clash than to block every booking because Google had a bad minute.
 * Pass `excludeEventId` when moving a booking so its own calendar event doesn't block it.
 */
export async function busyForDate(opts: {
  hostId: string;
  date: string;
  timeZone: string;
  excludeEventId?: string | null;
}): Promise<BusyInterval[]> {
  try {
    const conn = await findConnection(opts.hostId);
    if (!conn) return [];
    const dayStart = fromZonedTime(`${opts.date} 00:00:00`, opts.timeZone);
    if (Number.isNaN(dayStart.getTime())) return [];
    const from = addDays(dayStart, -1);
    const to = addDays(dayStart, 2);
    const token = await accessToken(conn);
    const exclude = opts.excludeEventId ?? undefined;
    return conn.provider === "google"
      ? await fetchGoogleBusy(token, from, to, opts.timeZone, exclude)
      : await fetchGraphBusy(token, from, to, opts.timeZone, exclude);
  } catch (err) {
    console.error("Could not read the host's calendar; ignoring it for now.", err);
    return [];
  }
}

// ——— Writing bookings ———

type EventDetails = {
  bookingId: string;
  title: string;
  description: string;
  location: string | null;
  start: Date;
  end: Date;
};

async function createEvent(conn: Connection, token: string, d: EventDetails) {
  if (conn.provider === "google") {
    const res = await call(token, `${GOOGLE}/events`, {
      method: "POST",
      body: {
        summary: d.title,
        description: d.description,
        location: d.location ?? undefined,
        start: { dateTime: d.start.toISOString() },
        end: { dateTime: d.end.toISOString() },
      },
    });
    if (!res.ok) throw await failure("Google event create", res);
    return ((await res.json()) as { id: string }).id;
  }
  const res = await call(token, `${GRAPH}/events`, {
    method: "POST",
    body: {
      subject: d.title,
      body: { contentType: "text", content: d.description },
      location: d.location ? { displayName: d.location } : undefined,
      start: { dateTime: d.start.toISOString().replace("Z", ""), timeZone: "UTC" },
      end: { dateTime: d.end.toISOString().replace("Z", ""), timeZone: "UTC" },
      // Makes a retried create return the same event instead of a duplicate.
      transactionId: d.bookingId,
    },
  });
  if (!res.ok) throw await failure("Outlook event create", res);
  return ((await res.json()) as { id: string }).id;
}

/** Moves an existing event; false means it no longer exists (deleted by the host). */
async function moveEvent(
  conn: Connection,
  token: string,
  eventId: string,
  start: Date,
  end: Date
) {
  const res =
    conn.provider === "google"
      ? await call(token, `${GOOGLE}/events/${encodeURIComponent(eventId)}`, {
          method: "PATCH",
          body: {
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
          },
        })
      : await call(token, `${GRAPH}/events/${encodeURIComponent(eventId)}`, {
          method: "PATCH",
          body: {
            start: { dateTime: start.toISOString().replace("Z", ""), timeZone: "UTC" },
            end: { dateTime: end.toISOString().replace("Z", ""), timeZone: "UTC" },
          },
        });
  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) throw await failure(`${conn.provider} event update`, res);
  return true;
}

async function deleteEvent(conn: Connection, token: string, eventId: string) {
  const url =
    conn.provider === "google"
      ? `${GOOGLE}/events/${encodeURIComponent(eventId)}?sendUpdates=none`
      : `${GRAPH}/events/${encodeURIComponent(eventId)}`;
  const res = await call(token, url, { method: "DELETE" });
  // Already gone is the outcome we wanted.
  if (res.ok || res.status === 404 || res.status === 410) return;
  throw await failure(`${conn.provider} event delete`, res);
}

async function loadBookingContext(bookingId: string) {
  return db
    .select({ booking, evt: eventType, host: user })
    .from(booking)
    .innerJoin(eventType, eq(booking.eventTypeId, eventType.id))
    .innerJoin(user, eq(booking.hostId, user.id))
    .where(eq(booking.id, bookingId))
    .get();
}

/**
 * Makes the host's calendar match this booking: adds an event the first time it's
 * confirmed, and moves it after a reschedule. Call after a booking is confirmed or moved.
 */
export async function syncBookingToCalendar(bookingId: string) {
  try {
    const row = await loadBookingContext(bookingId);
    if (!row || row.booking.status !== "confirmed") return;
    const { booking: b, evt, host } = row;

    // An event already on a calendar stays there even if the host has since switched.
    const conn = await findConnection(host.id, b.calendarEventProvider ?? undefined);
    if (!conn) return;
    const token = await accessToken(conn);

    if (b.calendarEventId && b.calendarEventProvider === conn.provider) {
      if (await moveEvent(conn, token, b.calendarEventId, b.startAt, b.endAt)) return;
      // The host deleted the event; put it back below.
    }

    const notes = [
      `Booked by ${b.guestName} <${b.guestEmail}> through Windsurf.`,
      b.guestNote ? `Note from guest: ${b.guestNote}` : null,
    ].filter(Boolean);
    const eventId = await createEvent(conn, token, {
      bookingId: b.id,
      title: `${evt.title} with ${b.guestName}`,
      description: notes.join("\n\n"),
      location: evt.locationValue,
      start: b.startAt,
      end: b.endAt,
    });
    await db
      .update(booking)
      .set({ calendarEventId: eventId, calendarEventProvider: conn.provider })
      .where(eq(booking.id, b.id));
  } catch (err) {
    console.error(`Could not sync booking ${bookingId} to the host's calendar`, err);
  }
}

/** Deletes the booking's calendar event, if it has one. Call after a booking is cancelled. */
export async function removeBookingFromCalendar(bookingId: string) {
  try {
    const [b] = await db.select().from(booking).where(eq(booking.id, bookingId)).limit(1);
    if (!b?.calendarEventId || !b.calendarEventProvider) return;
    const conn = await findConnection(b.hostId, b.calendarEventProvider);
    if (!conn) return;
    await deleteEvent(conn, await accessToken(conn), b.calendarEventId);
    await db
      .update(booking)
      .set({ calendarEventId: null, calendarEventProvider: null })
      .where(eq(booking.id, b.id));
  } catch (err) {
    console.error(`Could not remove booking ${bookingId} from the host's calendar`, err);
  }
}
