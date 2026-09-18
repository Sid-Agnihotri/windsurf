import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { eventType, user } from "@/db/schema";
import { planLimits } from "@/lib/plans";
import { EventTypesManager } from "@/components/dashboard/event-types-manager";

export default async function EventsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  const events = await db
    .select()
    .from(eventType)
    .where(eq(eventType.hostId, u.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Event types
        </h1>
        <p className="text-muted-foreground">
          {planLimits(u.plan).label} plan:{" "}
          {Number.isFinite(planLimits(u.plan).maxEventTypes)
            ? `up to ${planLimits(u.plan).maxEventTypes} event type(s)`
            : "unlimited event types"}
          . Paid pricing requires Pro+ and Stripe Connect.
        </p>
      </div>
      <EventTypesManager
        events={events}
        plan={u.plan}
        connectOnboarded={u.stripeConnectOnboarded}
        username={u.username}
      />
    </div>
  );
}
