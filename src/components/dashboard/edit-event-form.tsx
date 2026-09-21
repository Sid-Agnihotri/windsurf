"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { EventType } from "@/db/schema";
import { deleteEventType, updateEventType } from "@/actions/host";
import { EventFormFields } from "@/components/dashboard/event-form-fields";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

export function EditEventForm({
  event,
  paidAllowed,
  connectOnboarded,
}: {
  event: EventType;
  paidAllowed: boolean;
  connectOnboarded: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      action={(fd) => {
        start(async () => {
          // On success the action redirects to the events list.
          const res = await updateEventType(event.id, fd);
          if (res?.error) setError(res.error);
        });
      }}
    >
      {error && (
        <p
          role="alert"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2"
        >
          {error}
        </p>
      )}
      <EventFormFields
        paidAllowed={paidAllowed}
        connectOnboarded={connectOnboarded}
        defaults={event}
      />
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Button
          type="submit"
          disabled={pending}
          className="bg-teal-800 hover:bg-teal-900"
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/events">Cancel</Link>
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              className="ml-auto"
            >
              Delete
            </Button>
          }
          title={`Delete "${event.title}"?`}
          description="Its bookings will be deleted too. This can't be undone."
          confirmLabel="Yes, delete event"
          cancelLabel="Keep event"
          onConfirm={() =>
            new Promise<void>((resolve) => {
              // Redirects to the events list when done.
              start(async () => {
                try {
                  await deleteEventType(event.id);
                } finally {
                  resolve();
                }
              });
            })
          }
        />
      </div>
    </form>
  );
}
