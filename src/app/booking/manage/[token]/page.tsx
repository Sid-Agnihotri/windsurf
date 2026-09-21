import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { loadHostSettings } from "@/lib/availability-data";
import { findBookingByToken } from "@/lib/booking-by-token";
import { guestChangeState } from "@/lib/manage";
import { balanceDueCents, formatMoney } from "@/lib/money";
import { ManageActions } from "@/components/booking/manage-actions";
import { BookingStatusBadge } from "@/components/dashboard/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = findBookingByToken(db, token);
  if (!row) notFound();
  const { booking: b, evt, host } = row;

  const settings = loadHostSettings(db, host.id);
  const state = guestChangeState({
    status: b.status,
    startAt: b.startAt,
    changeNoticeHours: settings.changeNoticeHours,
  });
  const balance = balanceDueCents(b);
  const hours = settings.changeNoticeHours;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-xl">{evt.title}</CardTitle>
            <BookingStatusBadge status={b.status} />
          </div>
          <CardDescription>with {host.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              {formatInTimeZone(
                b.startAt,
                host.timezone,
                "EEEE, MMM d yyyy 'at' h:mm a zzz"
              )}
            </p>
            <p className="text-muted-foreground">
              {evt.durationMinutes} minutes
              {evt.locationValue ? ` · ${evt.locationValue}` : ""}
            </p>
            {(b.totalCents > 0 || b.amountPaidCents > 0) && b.status !== "cancelled" && (
              <p className="text-muted-foreground">
                {b.status === "pending_payment"
                  ? "Waiting for payment"
                  : `Paid ${formatMoney(b.amountPaidCents)}`}
                {b.status !== "pending_payment" && balance > 0
                  ? ` · ${formatMoney(balance)} due in person`
                  : ""}
              </p>
            )}
          </div>

          {state === "cancelled" && (
            <p className="text-sm text-muted-foreground">
              This booking was cancelled.
              {b.amountPaidCents > 0
                ? ` You paid ${formatMoney(b.amountPaidCents)}. Refunds are handled by ${host.name}, so please contact them.`
                : ""}
            </p>
          )}
          {state === "past" && (
            <p className="text-sm text-muted-foreground">
              This appointment has already passed.
            </p>
          )}
          {state === "too_late" && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Changes are closed within {hours} hour{hours === 1 ? "" : "s"} of the
              appointment. Please contact {host.name} at{" "}
              <a href={`mailto:${host.email}`} className="underline">
                {host.email}
              </a>
              .
            </p>
          )}
          {(state === "ok" || state === "pending_payment") && (
            <ManageActions
              token={token}
              hostName={host.name}
              hostTimeZone={host.timezone}
              canReschedule={state === "ok"}
              paidLabel={b.amountPaidCents > 0 ? formatMoney(b.amountPaidCents) : null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
