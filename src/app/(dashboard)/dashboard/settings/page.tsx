import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { canUseCustomBranding } from "@/lib/plans";
import { ProfileForm } from "@/components/dashboard/profile-form";

export default async function SettingsPage() {
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
    </div>
  );
}
