import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getTimezoneGroups } from "@/lib/timezones";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  return (
    <div className="max-w-2xl space-y-6">
      {welcome && (
        <Alert>
          <AlertTitle>Welcome to Windsurf!</AlertTitle>
          <AlertDescription>
            We picked a public username and timezone for you. Check them below,
            and change either if they&apos;re not right.
          </AlertDescription>
        </Alert>
      )}
      <ProfileForm
        timezoneGroups={getTimezoneGroups(u.timezone)}
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
    </div>
  );
}
