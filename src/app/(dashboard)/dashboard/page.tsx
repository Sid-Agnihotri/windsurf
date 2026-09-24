import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { booking, eventType, user } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { appUrl } from "@/lib/stripe";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { SetupStatusCard } from "@/components/dashboard/setup-status-card";
import { CalendarResultAlert } from "@/components/dashboard/calendar-result-alert";
import {
  BookingStatusBadge,
  PaymentBadge,
} from "@/components/dashboard/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint: string;
  href: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <Link
          href={href}
          className="text-xs text-muted-foreground hover:text-teal-800 hover:underline"
        >
          {hint}
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string }>;
}) {
  const { calendar } = await searchParams;
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  // "Today" and "this month" are measured in the host's timezone.
  const tz = u.timezone;
  const now = new Date();
  const todayStr = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const dayStart = fromZonedTime(`${todayStr} 00:00:00`, tz);
  const tomorrowStr = formatInTimeZone(addMinutes(dayStart, 36 * 60), tz, "yyyy-MM-dd");
  const dayEnd = fromZonedTime(`${tomorrowStr} 00:00:00`, tz);
  const monthStr = formatInTimeZone(now, tz, "yyyy-MM");
  const monthStart = fromZonedTime(`${monthStr}-01 00:00:00`, tz);
  const nextMonthStr = formatInTimeZone(addDays(monthStart, 40), tz, "yyyy-MM");
  const monthEnd = fromZonedTime(`${nextMonthStr}-01 00:00:00`, tz);

  const mine = eq(booking.hostId, u.id);

  const [{ today }] = await db
    .select({ today: sql<number>`count(*)`.mapWith(Number) })
    .from(booking)
    .where(
      and(mine, eq(booking.status, "confirmed"), gte(booking.startAt, dayStart), lt(booking.startAt, dayEnd))
    );

  const [{ nextWeek }] = await db
    .select({ nextWeek: sql<number>`count(*)`.mapWith(Number) })
    .from(booking)
    .where(
      and(mine, eq(booking.status, "confirmed"), gte(booking.startAt, now), lt(booking.startAt, addDays(now, 7)))
    );

  const [{ collected }] = await db
    .select({
      collected: sql<number>`coalesce(sum(${booking.amountPaidCents}), 0)`.mapWith(Number),
    })
    .from(booking)
    .where(
      and(
        mine,
        inArray(booking.status, ["confirmed", "completed"]),
        gte(booking.startAt, monthStart),
        lt(booking.startAt, monthEnd)
      )
    );

  const [{ outstanding }] = await db
    .select({
      outstanding: sql<number>`coalesce(sum(max(0, ${booking.totalCents} - max(0, ${booking.amountPaidCents} - ${booking.tipCents}))), 0)`.mapWith(Number),
    })
    .from(booking)
    .where(and(mine, inArray(booking.status, ["confirmed", "completed"])));

  const upcoming = await db
    .select({
      id: booking.id,
      guestName: booking.guestName,
      startAt: booking.startAt,
      status: booking.status,
      totalCents: booking.totalCents,
      amountPaidCents: booking.amountPaidCents,
      tipCents: booking.tipCents,
      title: eventType.title,
    })
    .from(booking)
    .innerJoin(eventType, eq(booking.eventTypeId, eventType.id))
    .where(
      and(
        mine,
        gte(booking.startAt, now),
        inArray(booking.status, ["confirmed", "pending_payment"])
      )
    )
    .orderBy(asc(booking.startAt))
    .limit(5);

  const events = await db
    .select()
    .from(eventType)
    .where(and(eq(eventType.hostId, u.id), eq(eventType.active, true)))
    .orderBy(asc(eventType.createdAt))
    .limit(6);

  const baseUrl = appUrl();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Welcome, {u.name}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {u.username ? (
            <>
              Your booking page:{" "}
              <Link
                href={`/${u.username}`}
                target="_blank"
                className="text-teal-800 underline"
              >
                {baseUrl}/{u.username}
              </Link>
            </>
          ) : (
            "Set a username in Settings to publish your page."
          )}
        </p>
      </div>

      <CalendarResultAlert result={calendar} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Today"
          value={today}
          hint={today === 1 ? "appointment today" : "appointments today"}
          href="/dashboard/bookings"
        />
        <Stat
          label="Next 7 days"
          value={nextWeek}
          hint="confirmed appointments"
          href="/dashboard/bookings"
        />
        <Stat
          label="Collected this month"
          value={formatMoney(collected)}
          hint="from this month's appointments"
          href="/dashboard/bookings"
        />
        <Stat
          label="Balance to collect"
          value={formatMoney(outstanding)}
          hint="still owed in person"
          href="/dashboard/bookings"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
            <CardDescription>Your next confirmed and pending bookings</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming bookings yet. Share one of your event links to get
                started.
              </p>
            ) : (
              <ul className="divide-y">
                {upcoming.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {b.guestName} · {b.title}
                      </p>
                      <p className="text-muted-foreground">
                        {formatInTimeZone(b.startAt, tz, "EEE MMM d · h:mm a")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PaymentBadge {...b} />
                      <BookingStatusBadge status={b.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your booking links</CardTitle>
              <CardDescription>
                Each event has its own link to share with customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You haven&apos;t created any events yet.
                  </p>
                  <Button asChild size="sm" className="bg-teal-800 hover:bg-teal-900">
                    <Link href="/dashboard/events/new">Create your first event</Link>
                  </Button>
                </div>
              ) : !u.username ? (
                <p className="text-sm text-amber-800">
                  Set a username in{" "}
                  <Link href="/dashboard/settings" className="underline">
                    Settings
                  </Link>{" "}
                  to get shareable links.
                </p>
              ) : (
                <ul className="divide-y">
                  {events.map((evt) => (
                    <li
                      key={evt.id}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <Link
                        href={`/dashboard/events/${evt.id}`}
                        className="min-w-0 truncate font-medium hover:underline"
                      >
                        {evt.title}
                      </Link>
                      <CopyLinkButton url={`${baseUrl}/${u.username}/${evt.slug}`} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <SetupStatusCard host={u} />
        </div>
      </div>
    </div>
  );
}
