import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Check } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { user, type Plan } from "@/db/schema";
import { PLAN_LIMITS } from "@/lib/plans";
import { getPlanUsage } from "@/lib/billing-usage";
import { stripeConfigured } from "@/lib/stripe";
import { UpgradeButton } from "@/components/dashboard/billing-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ORDER: Plan[] = ["free", "pro", "expert"];

const price = (cents: number) => (cents === 0 ? "Free" : `$${(cents / 100).toFixed(0)}/mo`);
const amount = (n: number, noun: string) =>
  Number.isFinite(n) ? `${n} ${noun}` : `Unlimited ${noun}`;

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = !Number.isFinite(limit);
  const ratio = unlimited ? 0 : Math.min(used / limit, 1);
  const full = !unlimited && used >= limit;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={full ? "font-medium text-red-700" : "text-muted-foreground"}>
          {unlimited ? `${used} · Unlimited` : `${used} of ${limit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${full ? "bg-red-500" : ratio >= 0.8 ? "bg-amber-500" : "bg-teal-600"}`}
            style={{ width: `${Math.max(ratio * 100, used > 0 ? 4 : 0)}%` }}
          />
        </div>
      )}
      {full && <p className="text-xs text-red-700">Limit reached. Upgrade to keep going.</p>}
    </div>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  if (!u) redirect("/sign-in");

  const sp = await searchParams;
  // Stripe onboarding used to return here; send anyone arriving with an old link to Payments.
  if (sp.connect) {
    redirect(`/dashboard/settings/payments?connect=${sp.connect}${sp.mock ? "&mock=1" : ""}`);
  }

  const usage = await getPlanUsage(u.id);
  const current = PLAN_LIMITS[u.plan];
  const upgrades = ORDER.slice(ORDER.indexOf(u.plan) + 1) as Array<"pro" | "expert">;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Plan &amp; billing
        </h1>
        <p className="text-muted-foreground">
          Your Windsurf plan and how much of it you&apos;re using. Card payments from
          guests are set up under{" "}
          <Link href="/dashboard/settings/payments" className="text-teal-800 underline">
            Settings → Payments
          </Link>
          .
        </p>
      </div>

      {process.env.NODE_ENV !== "production" && !stripeConfigured() && (
        <Alert>
          <AlertTitle>Stripe keys not configured (development)</AlertTitle>
          <AlertDescription>
            Upgrades use a mock that changes your plan in the database. Set{" "}
            <code className="text-xs">STRIPE_SECRET_KEY</code> and the price IDs to use real Checkout.
          </AlertDescription>
        </Alert>
      )}

      {sp.success && (
        <Alert>
          <AlertTitle>Plan updated{sp.mock ? " (mock)" : ""}</AlertTitle>
          <AlertDescription>
            You&apos;re now on the <strong>{current.label}</strong> plan.
          </AlertDescription>
        </Alert>
      )}
      {sp.canceled && (
        <Alert>
          <AlertDescription>Checkout was cancelled. Your plan hasn&apos;t changed.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-baseline gap-2">
            {current.label} plan
            {current.priceMonthlyCents > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {price(current.priceMonthlyCents)}
              </span>
            )}
          </CardTitle>
          <CardDescription>Usage this month</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UsageRow label="Events" used={usage.events} limit={current.maxEventTypes} />
          <UsageRow
            label="Bookings this month"
            used={usage.bookingsThisMonth}
            limit={current.maxBookingsPerMonth}
          />
        </CardContent>
      </Card>

      {upgrades.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You&apos;re on our top plan. Nothing more to upgrade.
        </p>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Upgrade</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {upgrades.map((key, i) => {
              const p = PLAN_LIMITS[key];
              return (
                <Card key={key} className="flex flex-col">
                  <CardHeader>
                    <CardTitle>{p.label}</CardTitle>
                    <CardDescription className="text-base text-foreground">
                      {price(p.priceMonthlyCents)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-2 text-sm">
                      {[
                        amount(p.maxEventTypes, "events"),
                        `${amount(p.maxBookingsPerMonth, "bookings")} a month`,
                        ...(p.customBranding ? ["Your own colours and logo"] : []),
                      ].map((line) => (
                        <li key={line} className="flex items-center gap-2">
                          <Check className="size-4 text-teal-700" /> {line}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <UpgradeButton plan={key} label={`Upgrade to ${p.label}`} primary={i === 0} />
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
