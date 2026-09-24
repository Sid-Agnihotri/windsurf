import Link from "next/link";
import { CircleCheck, Circle, TriangleAlert } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { availabilityRule, eventType, type User } from "@/db/schema";
import { getCalendarStatus, type CalendarStatus } from "@/lib/calendar-status";
import { CALENDAR_LABEL, PROVIDER_LABEL } from "@/lib/social-providers";
import {
  AddMissingBookingsButton,
  ConnectCalendarButton,
  ResumeCalendarButton,
} from "@/components/dashboard/calendar-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Tone = "ok" | "warn" | "todo";

type Row = {
  key: string;
  tone: Tone;
  title: string;
  detail: string;
  actions?: React.ReactNode;
};

const ICON = {
  ok: <CircleCheck className="size-5 text-teal-700" aria-label="Working" />,
  warn: <TriangleAlert className="size-5 text-amber-600" aria-label="Needs attention" />,
  todo: <Circle className="size-5 text-slate-400" aria-label="Not set up" />,
};

function calendarRow(status: CalendarStatus): Row | null {
  switch (status.state) {
    case "unavailable":
      return null;
    case "not_linked":
      return {
        key: "calendar",
        tone: "todo",
        title: "No calendar connected",
        detail:
          "Connect Google or Outlook so guests can't book over your existing events, and new bookings appear on your calendar.",
        actions: status.providers.map((p) => (
          <ConnectCalendarButton key={p} provider={p} returnTo="/dashboard" />
        )),
      };
    case "no_access":
      return {
        key: "calendar",
        tone: "warn",
        title: "Calendar access not granted",
        detail: `You signed in with ${PROVIDER_LABEL[status.provider]}, but didn't allow calendar access. Until you do, guests can book over your existing events.`,
        actions: (
          <ConnectCalendarButton
            provider={status.provider}
            returnTo="/dashboard"
            label="Allow calendar access"
          />
        ),
      };
    case "paused":
      return {
        key: "calendar",
        tone: "todo",
        title: "Calendar sync is paused",
        detail: `${CALENDAR_LABEL[status.provider]} is connected but not being used, so guests can book over your existing events.`,
        actions: <ResumeCalendarButton />,
      };
    case "broken":
      return {
        key: "calendar",
        tone: "warn",
        title: "Calendar connection lost",
        detail: `We can't reach your ${CALENDAR_LABEL[status.provider]}. Access may have been revoked or expired. Until you reconnect, guests can book over your existing events and new bookings won't be added.`,
        actions: (
          <ConnectCalendarButton
            provider={status.provider}
            returnTo="/dashboard"
            label="Reconnect"
          />
        ),
      };
    case "connected":
      return status.missing > 0
        ? {
            key: "calendar",
            tone: "warn",
            title: `${CALENDAR_LABEL[status.provider]} connected`,
            detail: `${status.missing} upcoming booking${status.missing === 1 ? " isn't" : "s aren't"} on your calendar yet (made before you connected, or when it couldn't be reached).`,
            actions: <AddMissingBookingsButton count={status.missing} />,
          }
        : {
            key: "calendar",
            tone: "ok",
            title: `${CALENDAR_LABEL[status.provider]} connected`,
            detail:
              "Your busy times block booking slots, and new bookings are added to your calendar.",
          };
  }
}

/**
 * Things that need the host to act, and nothing else: an unconnected or broken calendar,
 * card payments that some event needs but can't take, or no weekly hours at all. When
 * everything is fine the card doesn't render.
 */
export async function SetupStatusCard({ host }: { host: User }) {
  const [calendar, rules, events] = await Promise.all([
    getCalendarStatus(host.id),
    db.select().from(availabilityRule).where(eq(availabilityRule.hostId, host.id)),
    db
      .select({
        pricingMode: eventType.pricingMode,
        acceptCash: eventType.acceptCash,
        tipsEnabled: eventType.tipsEnabled,
      })
      .from(eventType)
      .where(and(eq(eventType.hostId, host.id), eq(eventType.active, true))),
  ]);

  // Card payments only matter if an active event can't be paid any other way.
  const needsCard = events.some(
    (e) => e.tipsEnabled || (e.pricingMode !== "free" && !e.acceptCash)
  );

  const rows: Row[] = [
    calendarRow(calendar),
    needsCard && !host.stripeConnectOnboarded
      ? {
          key: "payments",
          tone: "warn" as const,
          title: "Card payments aren't set up",
          detail:
            "Some of your events need a card payment or take tips, but guests can't pay until you connect Stripe.",
          actions: (
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/settings/payments">Set up payments</Link>
            </Button>
          ),
        }
      : null,
    rules.length === 0
      ? {
          key: "availability",
          tone: "warn" as const,
          title: "No weekly hours set",
          detail: "Guests can't book you until you add the days and times you're available.",
          actions: (
            <Button asChild size="sm" className="bg-teal-800 hover:bg-teal-900">
              <Link href="/dashboard/settings/availability">Set your hours</Link>
            </Button>
          ),
        }
      : null,
  ].filter((r): r is Row => r !== null && r.tone !== "ok");

  if (rows.length === 0) return null;
  const urgent = rows.some((r) => r.tone === "warn");

  return (
    <Card className={urgent ? "border-amber-300" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle>{urgent ? "Needs your attention" : "Finish setting up"}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-0.5 shrink-0">{ICON[row.tone]}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="text-sm text-muted-foreground">{row.detail}</p>
                </div>
                {row.actions && <div className="flex flex-wrap items-center gap-2">{row.actions}</div>}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
