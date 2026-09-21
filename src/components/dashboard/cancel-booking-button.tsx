"use client";

import { cancelBooking } from "@/actions/host";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

export function CancelBookingButton({
  id,
  guestName,
  eventTitle,
  paidLabel,
}: {
  id: string;
  guestName: string;
  eventTitle: string;
  /** e.g. "$20.00 CAD" when the guest has paid something, else null */
  paidLabel: string | null;
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          Cancel
        </Button>
      }
      title="Cancel this booking?"
      description={
        <>
          {guestName} will be emailed that their {eventTitle} booking was
          cancelled. This can&apos;t be undone.
          {paidLabel
            ? ` They have paid ${paidLabel}, so refund it yourself from Stripe or in person.`
            : ""}
        </>
      }
      confirmLabel="Yes, cancel booking"
      cancelLabel="Keep booking"
      onConfirm={async () => {
        await cancelBooking(id);
      }}
    />
  );
}
