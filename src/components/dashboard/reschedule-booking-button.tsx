"use client";

import { useState, useTransition } from "react";
import {
  getHostRescheduleSlots,
  rescheduleBookingAsHost,
} from "@/actions/host";
import { SlotPicker } from "@/components/booking/slot-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RescheduleBookingButton({
  id,
  guestName,
  eventTitle,
  currentLabel,
  hostTimeZone,
}: {
  id: string;
  guestName: string;
  eventTitle: string;
  /** The booking's current time, already formatted in the host's timezone */
  currentLabel: string;
  hostTimeZone: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setSelected(null);
      setError(null);
    }
  }

  function move() {
    if (!selected) return;
    start(async () => {
      const res = await rescheduleBookingAsHost(id, selected);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setSelected(null);
      setError(null);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Reschedule {eventTitle}</DialogTitle>
          <DialogDescription>
            {guestName} is booked for {currentLabel}. Pick a new time and
            they&apos;ll be emailed.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p
            role="alert"
            className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {error}
          </p>
        )}

        <SlotPicker
          hostTimeZone={hostTimeZone}
          loadSlots={(date) => getHostRescheduleSlots(id, date)}
          selected={selected}
          onSelect={setSelected}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Keep current time
          </Button>
          <Button
            type="button"
            disabled={!selected || pending}
            onClick={move}
            className="bg-teal-800 hover:bg-teal-900"
          >
            {pending ? "Moving…" : "Move booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
