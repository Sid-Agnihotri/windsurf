"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CalendarProvider } from "@/db/schema";
import { setCalendarChoice, syncMissingBookings } from "@/actions/calendar";
import { authClient } from "@/lib/auth-client";
import { CALENDAR_LABEL, PROVIDER_LABEL } from "@/lib/social-providers";
import { Button } from "@/components/ui/button";

/**
 * Sends the host to Google or Microsoft to grant calendar access, then back to `returnTo`
 * with `?calendar=connected` (or `=error`). Also used to reconnect a broken connection.
 */
export function ConnectCalendarButton({
  provider,
  returnTo,
  label,
  variant = "default",
}: {
  provider: CalendarProvider;
  returnTo: string;
  label?: string;
  variant?: "default" | "outline";
}) {
  const [connecting, setConnecting] = useState(false);

  async function connect() {
    setConnecting(true);
    const { error } = await authClient.linkSocial({
      provider,
      callbackURL: `${returnTo}?calendar=connected`,
      errorCallbackURL: `${returnTo}?calendar=error`,
      // Forces the consent screen so Google hands back a fresh refresh token.
      additionalParams: provider === "google" ? { prompt: "consent" } : undefined,
    });
    // On success the browser is already navigating to the provider.
    if (error) {
      setConnecting(false);
      toast.error(error.message || `Could not connect ${PROVIDER_LABEL[provider]}`);
    }
  }

  return (
    <Button
      size="sm"
      variant={variant}
      className={variant === "default" ? "bg-teal-800 hover:bg-teal-900" : ""}
      disabled={connecting}
      onClick={connect}
    >
      {connecting ? "Redirecting…" : (label ?? `Connect ${CALENDAR_LABEL[provider]}`)}
    </Button>
  );
}

export function ResumeCalendarButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setCalendarChoice("auto");
          if (res.error) toast.error(res.error);
          else router.refresh();
        })
      }
    >
      {pending ? "Resuming…" : "Resume sync"}
    </Button>
  );
}

export function AddMissingBookingsButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await syncMissingBookings();
          if ("error" in res) toast.error(res.error);
          else if (res.remaining > 0)
            toast.warning(
              `Added ${res.added}, but ${res.remaining} couldn't be added. Try reconnecting your calendar.`
            );
          else toast.success(`Added ${res.added} booking${res.added === 1 ? "" : "s"} to your calendar.`);
          router.refresh();
        })
      }
    >
      {pending ? "Adding…" : `Add ${count === 1 ? "it" : "them"}`}
    </Button>
  );
}
