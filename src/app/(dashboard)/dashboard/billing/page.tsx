import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { PLAN_LIMITS } from "@/lib/plans";
import { stripeConfigured } from "@/lib/stripe";
import { BillingActions } from "@/components/dashboard/billing-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  const sp = await searchParams;
  const success = sp.success;
  const mock = sp.mock;
  const connect = sp.connect;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Billing & payouts
        </h1>
        <p className="text-muted-foreground">
          Subscribe to Windsurf for higher limits. Connect Stripe Express to
          receive guest payments.
        </p>
      </div>

      {!stripeConfigured() && (
        <Alert>
          <AlertTitle>Stripe keys not configured</AlertTitle>
          <AlertDescription>
            Upgrade and Connect flows use a safe mock that updates your plan /
            Connect status in the database. Add{" "}
            <code className="text-xs">STRIPE_SECRET_KEY</code> and price IDs to
            use real Checkout.
          </AlertDescription>
        </Alert>
      )}

      {(success || connect === "return") && (
        <Alert>
          <AlertTitle>
            {connect === "return" ? "Connect updated" : "Plan updated"}
            {mock ? " (mock)" : ""}
          </AlertTitle>
          <AlertDescription>
            Your account has been refreshed. Current plan:{" "}
            <strong>{PLAN_LIMITS[u.plan].label}</strong>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLAN_LIMITS) as Array<keyof typeof PLAN_LIMITS>).map(
          (key) => {
            const p = PLAN_LIMITS[key];
            const current = u.plan === key;
            return (
              <Card
                key={key}
                className={current ? "border-teal-700 shadow-sm" : ""}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.label}</CardTitle>
                    {current && <Badge>Current</Badge>}
                  </div>
                  <CardDescription>
                    {p.priceMonthlyCents === 0
                      ? "$0"
                      : `$${(p.priceMonthlyCents / 100).toFixed(0)}/mo`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Event types:{" "}
                    {Number.isFinite(p.maxEventTypes)
                      ? p.maxEventTypes
                      : "Unlimited"}
                  </p>
                  <p>
                    Bookings / month:{" "}
                    {Number.isFinite(p.maxBookingsPerMonth)
                      ? p.maxBookingsPerMonth
                      : "Unlimited"}
                  </p>
                  <p>Paid / tips / deposits: {p.paidEvents ? "Yes" : "No"}</p>
                  <p>Custom branding: {p.customBranding ? "Yes" : "No"}</p>
                </CardContent>
              </Card>
            );
          }
        )}
      </div>

      <BillingActions
        plan={u.plan}
        connectOnboarded={u.stripeConnectOnboarded}
        connectAccountId={u.stripeConnectAccountId}
      />
    </div>
  );
}
