"use client";

import { useTransition } from "react";
import { markBookingPaid } from "@/actions/host";
import { Button } from "@/components/ui/button";

export function MarkPaidButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markBookingPaid(id);
        })
      }
    >
      {pending ? "Saving…" : "Mark paid"}
    </Button>
  );
}
