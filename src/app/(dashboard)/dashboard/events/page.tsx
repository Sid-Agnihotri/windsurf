import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { eventType, user } from "@/db/schema";
import { appUrl } from "@/lib/stripe";
import { EventsList } from "@/components/dashboard/events-list";

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
    .where(eq(eventType.hostId, u.id))
    .orderBy(eventType.createdAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Events
        </h1>
        <p className="text-muted-foreground">
          Each event has its own booking link. Card payments need Stripe
          Connect (under Billing); cash doesn&apos;t.
        </p>
      </div>
      <EventsList
        events={events}
        plan={u.plan}
        username={u.username}
        baseUrl={appUrl()}
      />
    </div>
  );
}
