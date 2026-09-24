import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { canUseCustomBranding } from "@/lib/plans";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { CalendarCard } from "@/components/dashboard/calendar-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const CALENDAR_RESULT: Record<string, string> = {
  connected: "Calendar connected. Your busy times now block slots, and new bookings will be added to it.",
  error:
    "We couldn't connect that calendar. It may already be linked to a different Windsurf account, or you may have cancelled.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; calendar?: string }>;
}) {
  const { welcome, calendar } = await searchParams;
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Profile, public username, timezone
          {canUseCustomBranding(u.plan) ? ", and Expert branding" : ""}.
        </p>
      </div>
      {welcome && (
        <Alert>
          <AlertTitle>Welcome to Windsurf!</AlertTitle>
          <AlertDescription>
            We picked a public username and timezone for you. Check them below,
            and change either if they&apos;re not right.
          </AlertDescription>
        </Alert>
      )}
      {calendar && CALENDAR_RESULT[calendar] && (
        <Alert variant={calendar === "error" ? "destructive" : "default"}>
          <AlertDescription>{CALENDAR_RESULT[calendar]}</AlertDescription>
        </Alert>
      )}
      <ProfileForm
        user={{
          name: u.name,
          username: u.username,
          timezone: u.timezone,
          bio: u.bio,
          brandPrimaryColor: u.brandPrimaryColor,
          brandLogoUrl: u.brandLogoUrl,
          plan: u.plan,
        }}
      />
      <CalendarCard userId={u.id} />
    </div>
  );
}
