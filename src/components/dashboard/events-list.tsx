import Link from "next/link";
import type { EventType, Plan } from "@/db/schema";
import { planLimits } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/dashboard/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function priceLabel(evt: EventType) {
  if (evt.pricingMode === "paid") return formatMoney(evt.priceCents);
  if (evt.pricingMode === "deposit") {
    return `${formatMoney(evt.priceCents)} (${formatMoney(evt.depositCents)} deposit)`;
  }
  return "Free";
}

export function EventsList({
  events,
  plan,
  username,
  baseUrl,
}: {
  events: EventType[];
  plan: Plan;
  username: string | null;
  /** Origin used to build shareable public links, e.g. http://127.0.0.1:43123 */
  baseUrl: string;
}) {
  const limits = planLimits(plan);
  const atCap = events.length >= limits.maxEventTypes;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {events.length} event{events.length === 1 ? "" : "s"}
          {Number.isFinite(limits.maxEventTypes)
            ? ` · ${limits.maxEventTypes} max on ${limits.label}`
            : ""}
        </p>
        {atCap ? (
          <Button disabled title="Upgrade to add more events">
            New event
          </Button>
        ) : (
          <Button asChild className="bg-teal-800 hover:bg-teal-900">
            <Link href="/dashboard/events/new">New event</Link>
          </Button>
        )}
      </div>

      {atCap && (
        <p className="text-sm text-amber-800">
          You&apos;ve reached the {limits.label} plan limit for events.{" "}
          <Link href="/dashboard/billing" className="underline">
            Upgrade
          </Link>{" "}
          to add more.
        </p>
      )}

      {events.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No events yet</CardTitle>
            <CardDescription>
              Create your first offering — e.g. “Dog walking” or “60-min massage”.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {events.map((evt) => {
                const url = username
                  ? `${baseUrl}/${username}/${evt.slug}`
                  : null;
                return (
                  <li
                    key={evt.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/events/${evt.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {evt.title}
                        </Link>
                        <StatusPill tone={evt.active ? "green" : "slate"}>
                          {evt.active ? "Active" : "Inactive"}
                        </StatusPill>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {evt.durationMinutes} min · {priceLabel(evt)}
                        {evt.acceptCash ? " · cash ok" : ""}
                        {evt.tipsEnabled ? " · tips on" : ""}
                      </p>
                      {url && (
                        <code className="block truncate text-xs text-slate-500">
                          {url}
                        </code>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {url && <CopyLinkButton url={url} />}
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="border-teal-700 text-teal-900"
                      >
                        <Link href={`/dashboard/events/${evt.id}`}>Edit</Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {!username && events.length > 0 && (
        <p className="text-sm text-amber-800">
          Set a username in{" "}
          <Link href="/dashboard/settings" className="underline">
            Settings
          </Link>{" "}
          to get shareable links for your events.
        </p>
      )}
    </div>
  );
}
