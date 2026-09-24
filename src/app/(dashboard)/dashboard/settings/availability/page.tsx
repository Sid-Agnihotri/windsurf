import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { availabilityOverride, availabilityRule, hostSettings, user } from "@/db/schema";
import { defaultHostSettings } from "@/lib/availability-data";
import { groupOverrides } from "@/lib/availability-input";
import { WeeklyHoursCard } from "@/components/dashboard/weekly-hours-card";
import { BookingRulesCard } from "@/components/dashboard/booking-rules-card";
import { TimeOffCard } from "@/components/dashboard/time-off-card";

export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  if (!u) redirect("/sign-in");

  const [rules, overrides, [settings]] = await Promise.all([
    db.select().from(availabilityRule).where(eq(availabilityRule.hostId, u.id)),
    db.select().from(availabilityOverride).where(eq(availabilityOverride.hostId, u.id)),
    db.select().from(hostSettings).where(eq(hostSettings.hostId, u.id)).limit(1),
  ]);
  // "Today" is the host's today, so a date is only hidden once it has passed where they are.
  const today = formatInTimeZone(new Date(), u.timezone, "yyyy-MM-dd");

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-6">
        <WeeklyHoursCard rules={rules} timeZone={u.timezone} />
        <BookingRulesCard settings={settings ?? defaultHostSettings(u.id)} />
      </div>
      <TimeOffCard groups={groupOverrides(overrides, today)} today={today} />
    </div>
  );
}
