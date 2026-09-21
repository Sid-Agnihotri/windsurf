import Link from "next/link";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { eventType, user } from "@/db/schema";
import { canCreateEventType, planLimits } from "@/lib/plans";
import { NewEventForm } from "@/components/dashboard/new-event-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function NewEventPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(eventType)
    .where(eq(eventType.hostId, u.id));
  const gate = canCreateEventType(u.plan, Number(existing));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          New event
        </h1>
        <p className="text-muted-foreground">
          Each event gets its own public booking link you can share, e.g. for
          &ldquo;Dog walking&rdquo; or &ldquo;Car washing&rdquo;.
        </p>
      </div>

      {!gate.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>{planLimits(u.plan).label} plan limit reached</CardTitle>
            <CardDescription>{gate.reason}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild className="bg-teal-800 hover:bg-teal-900">
              <Link href="/dashboard/billing">Upgrade</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/events">Back to events</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <NewEventForm
              paidAllowed={planLimits(u.plan).paidEvents}
              connectOnboarded={u.stripeConnectOnboarded}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
