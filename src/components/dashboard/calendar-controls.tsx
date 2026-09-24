"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CalendarProvider } from "@/db/schema";
import { setCalendarChoice, type CalendarChoice } from "@/actions/calendar";
import { CALENDAR_LABEL, PROVIDER_LABEL } from "@/lib/social-providers";
import { ConnectCalendarButton } from "@/components/dashboard/calendar-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ProviderState = {
  provider: CalendarProvider;
  /** not_linked: never signed in with it. no_calendar_access: signed in but skipped the calendar permission. */
  status: "connected" | "no_calendar_access" | "not_linked";
};

export function CalendarControls({
  providers,
  choice,
}: {
  providers: ProviderState[];
  /** The saved choice: null = automatic, "off" = paused. */
  choice: CalendarProvider | "off" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const connected = providers.filter((p) => p.status === "connected");
  // What is in effect: an explicit pick if it's still connected, else the first connected one.
  const active =
    choice === "off"
      ? null
      : (connected.find((p) => p.provider === choice) ?? connected[0])?.provider ?? null;

  function choose(next: CalendarChoice) {
    startTransition(async () => {
      const res = await setCalendarChoice(next);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border">
        {providers.map(({ provider, status }) => (
          <li key={provider} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{CALENDAR_LABEL[provider]}</p>
              <p className="text-sm text-muted-foreground">
                {status === "connected" && "Connected"}
                {status === "no_calendar_access" &&
                  `You signed in with ${PROVIDER_LABEL[provider]} but didn't allow calendar access.`}
                {status === "not_linked" && `Not connected`}
              </p>
            </div>
            {status === "connected" && active === provider && (
              <Badge className="bg-teal-100 text-teal-900">In use</Badge>
            )}
            <ConnectCalendarButton
              provider={provider}
              returnTo="/dashboard/settings/calendar"
              variant={status === "connected" ? "outline" : "default"}
              label={
                status === "connected"
                  ? "Reconnect"
                  : status === "no_calendar_access"
                    ? "Allow calendar access"
                    : "Connect"
              }
            />
          </li>
        ))}
      </ul>

      {connected.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          Use
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={choice ?? "auto"}
            disabled={pending}
            onChange={(e) => choose(e.target.value as CalendarChoice)}
          >
            <option value="auto">the first connected calendar</option>
            {connected.map(({ provider }) => (
              <option key={provider} value={provider}>
                {CALENDAR_LABEL[provider]}
              </option>
            ))}
            <option value="off">none (pause calendar sync)</option>
          </select>
        </label>
      )}
      {connected.length === 1 && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => choose(choice === "off" ? "auto" : "off")}
        >
          {choice === "off" ? "Resume calendar sync" : "Pause calendar sync"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Windsurf only reads whether you&apos;re busy and adds events for your own
        bookings. Guests never see your calendar. Revoke access any time from your
        Google or Microsoft account.
      </p>
    </div>
  );
}
