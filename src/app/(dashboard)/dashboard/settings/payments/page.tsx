import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { eventType, user, type EventType } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { ConnectStripeButton } from "@/components/dashboard/billing-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function priceLabel(e: EventType) {
  if (e.pricingMode === "free") return "Free";
  if (e.pricingMode === "deposit") {
    return `${formatMoney(e.depositCents)} deposit of ${formatMoney(Math.max(e.priceCents, e.depositCents))}`;
  }
  return formatMoney(e.priceCents);
}

/** Card payments are needed unless the event is free (tips always go by card) or cash-only. */
function needsCard(e: EventType) {
  return e.tipsEnabled || (e.pricingMode !== "free" && !e.acceptCash);
}

export default async function PaymentsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string; mock?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const { connect } = await searchParams;
  const [u] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  if (!u) redirect("/sign-in");

  const events = await db
    .select()
    .from(eventType)
    .where(and(eq(eventType.hostId, u.id)))
    .orderBy(asc(eventType.createdAt));
  const connected = u.stripeConnectOnboarded;

  return (
    <div className="max-w-3xl space-y-6">
      {connect === "return" && (
        <Alert>
          <AlertTitle>{connected ? "Stripe is connected" : "Stripe needs a few more details"}</AlertTitle>
          <AlertDescription>
            {connected
              ? "You're ready to take card payments and tips."
              : "Stripe hasn't confirmed your account yet. Finish the remaining steps, or check back in a moment if you just completed them."}
          </AlertDescription>
        </Alert>
      )}
      {connect === "refresh" && (
        <Alert variant="destructive">
          <AlertDescription>That Stripe link expired. Start again below.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Card payments
            <Badge className={connected ? "bg-teal-100 text-teal-900" : ""} variant={connected ? "default" : "secondary"}>
              {connected ? "Connected" : "Not connected"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Guests pay you directly through Stripe, in CAD. You need this for card payments,
            deposits and tips. Free events and pay-in-person (cash) events don&apos;t need it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <ConnectStripeButton
            primary={!connected}
            label={connected ? "Manage Stripe account" : "Connect Stripe"}
          />
          {connected && u.stripeConnectAccountId && (
            <span className="text-xs text-muted-foreground">Account {u.stripeConnectAccountId}</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How guests pay</CardTitle>
          <CardDescription>
            Set per event when you create or edit it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events yet.{" "}
              <Link href="/dashboard/events/new" className="text-teal-800 underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y">
              {events.map((e) => {
                const blocked = e.active && needsCard(e) && !connected;
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/events/${e.id}`}
                        className="font-medium hover:underline"
                      >
                        {e.title}
                      </Link>
                      {!e.active && <span className="ml-2 text-xs text-muted-foreground">inactive</span>}
                      <p className="text-muted-foreground">{priceLabel(e)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {e.pricingMode !== "free" && <Badge variant="secondary">Card</Badge>}
                      {e.pricingMode !== "free" && e.acceptCash && <Badge variant="secondary">Cash</Badge>}
                      {e.tipsEnabled && <Badge variant="secondary">Tips</Badge>}
                      {blocked && (
                        <Badge className="bg-amber-100 text-amber-900">Needs Stripe</Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
