"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createEventType } from "@/actions/host";
import { EventFormFields } from "@/components/dashboard/event-form-fields";
import { Button } from "@/components/ui/button";

export function NewEventForm({
  paidAllowed,
  connectOnboarded,
}: {
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
          const res = await createEventType(fd);
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
      />
      <div className="flex gap-2 sm:col-span-2">
        <Button
          type="submit"
          disabled={pending}
          className="bg-teal-800 hover:bg-teal-900"
        >
          {pending ? "Creating…" : "Create event"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/events">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
