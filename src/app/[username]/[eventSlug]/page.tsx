import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { formatMoney } from "@/lib/money";
import { eventType, user } from "@/db/schema";
import { canUseCustomBranding } from "@/lib/plans";
import { BookingWizard } from "@/components/booking/booking-wizard";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ username: string; eventSlug: string }>;
}) {
  const { username, eventSlug } = await params;
  const [host] = await db
    .select()
    .from(user)
    .where(eq(user.username, username.toLowerCase()))
    .limit(1);
  if (!host) notFound();

  const [evt] = await db
    .select()
    .from(eventType)
    .where(
      and(
        eq(eventType.hostId, host.id),
        eq(eventType.slug, eventSlug),
        eq(eventType.active, true)
      )
    )
    .limit(1);
  if (!evt) notFound();

  const branding = canUseCustomBranding(host.plan);
  const accent =
    branding && host.brandPrimaryColor ? host.brandPrimaryColor : "#0f766e";

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(ellipse at top, ${accent}22 0%, #f8fafc 50%)`,
      }}
    >
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          <a href={`/${host.username}`} className="hover:underline">
            ← {host.name}
          </a>
        </p>
        <h1
          className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold md:text-4xl"
          style={{ color: accent }}
        >
          {evt.title}
        </h1>
        <p className="mt-2 text-slate-600">
          {evt.durationMinutes} min
          {evt.pricingMode === "paid"
            ? ` · ${formatMoney(evt.priceCents)}`
            : evt.pricingMode === "deposit"
              ? ` · ${formatMoney(evt.priceCents)} (${formatMoney(evt.depositCents)} deposit)`
              : " · Free"}
          {evt.acceptCash ? " · cash accepted" : ""}
          {evt.tipsEnabled ? " · tips welcome" : ""}
        </p>
        {evt.description && (
          <p className="mt-3 max-w-xl text-slate-600">{evt.description}</p>
        )}

        <div className="mt-8">
          <BookingWizard
            username={host.username!}
            eventSlug={evt.slug}
            hostTimeZone={host.timezone}
            tipsEnabled={evt.tipsEnabled}
            pricingMode={evt.pricingMode}
            priceCents={evt.priceCents}
            depositCents={evt.depositCents}
            acceptCash={evt.acceptCash}
            cardAvailable={host.stripeConnectOnboarded}
            accent={accent}
          />
        </div>
      </div>
    </div>
  );
}
