import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { balanceDueCents, formatMoney } from "@/lib/money";
import { booking, eventType, user } from "@/db/schema";
import { CancelBookingButton } from "@/components/dashboard/cancel-booking-button";
import { MarkPaidButton } from "@/components/dashboard/mark-paid-button";
import { RescheduleBookingButton } from "@/components/dashboard/reschedule-booking-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BookingStatusBadge,
  PaymentBadge,
} from "@/components/dashboard/status-badge";

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
      totalCents: booking.totalCents,
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
    totalCents: number;
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
                  {b.status === "pending_payment" ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Awaiting online payment
                    </p>
                  ) : (
                    (b.amountPaidCents > 0 || b.totalCents > 0) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Paid {formatMoney(b.amountPaidCents)}
                        {b.tipCents > 0
                          ? ` (incl. tip ${formatMoney(b.tipCents)})`
                          : ""}
                        {b.status !== "cancelled" && balanceDueCents(b) > 0
                          ? ` · Balance due in person ${formatMoney(balanceDueCents(b))}`
                          : ""}
                      </p>
                    )
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <PaymentBadge {...b} />
                  <BookingStatusBadge status={b.status} />
                  {(b.status === "confirmed" || b.status === "completed") &&
                    balanceDueCents(b) > 0 && <MarkPaidButton id={b.id} />}
                  {b.status === "confirmed" && b.startAt >= new Date() && (
                    <RescheduleBookingButton
                      id={b.id}
                      guestName={b.guestName}
                      eventTitle={b.title}
                      currentLabel={formatInTimeZone(
                        b.startAt,
                        timeZone,
                        "EEE, MMM d · h:mm a"
                      )}
                      hostTimeZone={timeZone}
                    />
                  )}
                  {b.status !== "cancelled" && b.startAt >= new Date() && (
                    <CancelBookingButton
                      id={b.id}
                      guestName={b.guestName}
                      eventTitle={b.title}
                      paidLabel={
                        b.amountPaidCents > 0
                          ? formatMoney(b.amountPaidCents)
                          : null
                      }
                    />
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
