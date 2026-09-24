import { eq } from "drizzle-orm";
import { db } from "@/db";
import { account, hostSettings } from "@/db/schema";
import {
  configuredProviders,
  hasCalendarScope,
  SOCIAL_PROVIDERS,
} from "@/lib/social-providers";
import {
  CalendarControls,
  type ProviderState,
} from "@/components/dashboard/calendar-controls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Connect Google or Outlook so bookings avoid existing events and land on the host's calendar. */
export async function CalendarCard({ userId }: { userId: string }) {
  const configured = configuredProviders();
  const [accounts, [settings]] = await Promise.all([
    db.select().from(account).where(eq(account.userId, userId)),
    db.select().from(hostSettings).where(eq(hostSettings.hostId, userId)).limit(1),
  ]);

  const providers: ProviderState[] = SOCIAL_PROVIDERS.filter((p) =>
    configured.includes(p)
  ).map((provider) => {
    const linked = accounts.find((a) => a.providerId === provider);
    return {
      provider,
      status: !linked
        ? "not_linked"
        : hasCalendarScope(provider, linked.scope)
          ? "connected"
          : "no_calendar_access",
    };
  });

  return (
    <Card className="border-teal-900/10">
      <CardHeader>
        <CardTitle className="font-[family-name:var(--font-display)] text-xl">
          Calendar
        </CardTitle>
        <CardDescription>
          Connect Google or Outlook so guests can&apos;t book over your existing events,
          and new bookings appear on your calendar automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Calendar sign-in isn&apos;t set up on this server yet. Add Google or
            Microsoft credentials to the environment (see the README).
          </p>
        ) : (
          <CalendarControls
            providers={providers}
            choice={settings?.calendarProvider ?? null}
          />
        )}
      </CardContent>
    </Card>
  );
}
