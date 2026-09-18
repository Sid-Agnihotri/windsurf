import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { booking, eventType, user } from "@/db/schema";
import { CancelBookingButton } from "@/components/dashboard/cancel-booking-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function BookingsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  const rows = await db
    .select({
      id: booking.id,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestNote: booking.guestNote,
      startAt: booking.startAt,
      endAt: booking.endAt,
      status: booking.status,
      amountPaidCents: booking.amountPaidCents,
      tipCents: booking.tipCents,
      title: eventType.title,
    })
    .from(booking)
    .innerJoin(eventType, eq(booking.eventTypeId, eventType.id))
    .where(eq(booking.hostId, u.id))
    .orderBy(desc(booking.startAt))
    .limit(100);

  const upcoming = rows.filter(
    (b) => b.startAt >= new Date() && b.status !== "cancelled"
  );
  const past = rows.filter(
    (b) => b.startAt < new Date() || b.status === "cancelled"
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Bookings
        </h1>
        <p className="text-muted-foreground">
          Upcoming and past appointments with your guests.
        </p>
      </div>

      <BookingList
        title="Upcoming"
        empty="No upcoming bookings."
        items={upcoming}
        timeZone={u.timezone}
      />
      <BookingList
        title="Past & cancelled"
        empty="Nothing here yet."
        items={past}
        timeZone={u.timezone}
      />
    </div>
  );
}

function BookingList({
  title,
  empty,
  items,
  timeZone,
}: {
  title: string;
  empty: string;
  timeZone: string;
  items: {
    id: string;
    guestName: string;
    guestEmail: string;
    guestNote: string | null;
    startAt: Date;
    status: string;
    amountPaidCents: number;
    tipCents: number;
    title: string;
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {items.length} booking{items.length === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {items.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-start justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-medium">
                    {b.guestName} · {b.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {b.guestEmail} ·{" "}
                    {formatInTimeZone(
                      b.startAt,
                      timeZone,
                      "EEE, MMM d yyyy · h:mm a"
                    )}
                  </p>
                  {b.guestNote && (
                    <p className="mt-1 text-sm italic text-slate-600">
                      “{b.guestNote}”
                    </p>
                  )}
                  {(b.amountPaidCents > 0 || b.tipCents > 0) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Paid ${(b.amountPaidCents / 100).toFixed(2)}
                      {b.tipCents > 0
                        ? ` + tip $${(b.tipCents / 100).toFixed(2)}`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {b.status.replace("_", " ")}
                  </Badge>
                  {b.status !== "cancelled" && b.startAt >= new Date() && (
                    <CancelBookingButton id={b.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
