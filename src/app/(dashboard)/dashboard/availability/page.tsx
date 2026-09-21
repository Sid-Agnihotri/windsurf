import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import {
  availabilityOverride,
  availabilityRule,
  hostSettings,
  user,
} from "@/db/schema";
import { AvailabilityEditor } from "@/components/dashboard/availability-editor";

export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  const rules = await db
    .select()
    .from(availabilityRule)
    .where(eq(availabilityRule.hostId, u.id));
  const overrides = await db
    .select()
    .from(availabilityOverride)
    .where(eq(availabilityOverride.hostId, u.id));
  const [settings] = await db
    .select()
    .from(hostSettings)
    .where(eq(hostSettings.hostId, u.id))
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Availability
        </h1>
        <p className="text-muted-foreground">
          Weekly hours in {u.timezone}, plus date overrides, buffers, and minimum
          notice.
        </p>
      </div>
      <AvailabilityEditor
        rules={rules}
        overrides={overrides}
        settings={
          settings || {
            hostId: u.id,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 15,
            minNoticeMinutes: 120,
            changeNoticeHours: 24,
          }
        }
      />
    </div>
  );
}
