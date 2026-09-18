"use client";

import { useTransition } from "react";
import { cancelBooking } from "@/actions/host";
import { Button } from "@/components/ui/button";

export function CancelBookingButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await cancelBooking(id);
        })
      }
    >
      Cancel
    </Button>
  );
}
