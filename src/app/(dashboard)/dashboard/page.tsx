import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq, gte, lt, ne } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { booking, eventType, user } from "@/db/schema";
import { planLimits } from "@/lib/plans";
import { monthBoundsUtc } from "@/lib/slots";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatInTimeZone } from "date-fns-tz";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  const limits = planLimits(u.plan);
  const [{ value: eventCount }] = await db
    .select({ value: count() })
    .from(eventType)
    .where(eq(eventType.hostId, u.id));
  const { start, end } = monthBoundsUtc();
  const [{ value: monthBookings }] = await db
    .select({ value: count() })
    .from(booking)
    .where(
      and(
        eq(booking.hostId, u.id),
        gte(booking.createdAt, start),
        lt(booking.createdAt, end),
        ne(booking.status, "cancelled")
      )
    );

  const upcoming = await db
    .select({
      id: booking.id,
      guestName: booking.guestName,
      startAt: booking.startAt,
      status: booking.status,
      title: eventType.title,
    })
    .from(booking)
    .innerJoin(eventType, eq(booking.eventTypeId, eventType.id))
    .where(
      and(
        eq(booking.hostId, u.id),
        gte(booking.startAt, new Date()),
        ne(booking.status, "cancelled")
      )
    )
    .orderBy(booking.startAt)
    .limit(5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Welcome, {u.name}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {u.username
            ? `Public link: /${u.username}`
            : "Set a username in Settings to publish your page."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Plan</CardDescription>
            <CardTitle>{limits.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/billing">Manage billing</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Event types</CardDescription>
            <CardTitle>
              {eventCount}
              {Number.isFinite(limits.maxEventTypes)
                ? ` / ${limits.maxEventTypes}`
                : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/events">Edit events</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bookings this month</CardDescription>
            <CardTitle>
              {monthBookings}
              {Number.isFinite(limits.maxBookingsPerMonth)
                ? ` / ${limits.maxBookingsPerMonth}`
                : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/bookings">View bookings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
          <CardDescription>Next confirmed and pending bookings</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming bookings yet. Share your public link to get started.
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
                      {formatInTimeZone(
                        b.startAt,
                        u.timezone,
                        "EEE MMM d · h:mm a"
                      )}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">
                    {b.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
