import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { formatMoney } from "@/lib/money";
import { eventType, user } from "@/db/schema";
import { canUseCustomBranding } from "@/lib/plans";
import { Badge } from "@/components/ui/badge";

export default async function PublicHostPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [host] = await db
    .select()
    .from(user)
    .where(eq(user.username, username.toLowerCase()))
    .limit(1);
  if (!host) notFound();

  const events = await db
    .select()
    .from(eventType)
    .where(and(eq(eventType.hostId, host.id), eq(eventType.active, true)));

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
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-10">
          {branding && host.brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={host.brandLogoUrl}
              alt=""
              className="mb-4 h-12 w-auto object-contain"
            />
          ) : (
            <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">
              Windsurf
            </p>
          )}
          <h1
            className="font-[family-name:var(--font-display)] text-4xl font-semibold"
            style={{ color: accent }}
          >
            {host.name}
          </h1>
          {host.bio && (
            <p className="mt-3 text-slate-600 leading-relaxed">{host.bio}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Times shown in your local timezone · Host is in {host.timezone}
          </p>
        </div>

        {events.length === 0 ? (
          <p className="text-muted-foreground">
            This host hasn&apos;t published any events yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {events.map((evt) => (
              <li key={evt.id}>
                <Link
                  href={`/${host.username}/${evt.slug}`}
                  className="block border border-slate-200 bg-white px-5 py-4 transition hover:border-teal-700/40 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-medium text-slate-900">
                        {evt.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {evt.durationMinutes} minutes
                        {evt.description
                          ? ` · ${evt.description.slice(0, 80)}${evt.description.length > 80 ? "…" : ""}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {evt.pricingMode === "free"
                        ? "Free"
                        : evt.pricingMode === "deposit"
                          ? `Deposit ${formatMoney(evt.depositCents, 0)}`
                          : formatMoney(evt.priceCents, 0)}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
