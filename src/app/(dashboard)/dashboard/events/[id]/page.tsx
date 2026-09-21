import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { eventType, user } from "@/db/schema";
import { planLimits } from "@/lib/plans";
import { appUrl } from "@/lib/stripe";
import { EditEventForm } from "@/components/dashboard/edit-event-form";
import { PublicLink } from "@/components/dashboard/public-link";
import { Card, CardContent } from "@/components/ui/card";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  const [evt] = await db
    .select()
    .from(eventType)
    .where(and(eq(eventType.id, id), eq(eventType.hostId, u.id)))
    .limit(1);
  if (!evt) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/events" className="hover:underline">
            ← Events
          </Link>
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          {evt.title}
        </h1>
        <p className="text-muted-foreground">
          Edit this event. Guests book it through its own link.
        </p>
      </div>

      <PublicLink
        username={u.username}
        slug={evt.slug}
        active={evt.active}
        baseUrl={appUrl()}
      />

      <Card>
        <CardContent className="pt-6">
          <EditEventForm
            event={evt}
            paidAllowed={planLimits(u.plan).paidEvents}
            connectOnboarded={u.stripeConnectOnboarded}
          />
        </CardContent>
      </Card>
    </div>
  );
}
