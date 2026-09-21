import Link from "next/link";
import { and, count, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { booking, eventType, user } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { planLimits } from "@/lib/plans";
import { monthBoundsUtc } from "@/lib/slots";
import { AdminPlanSelect } from "@/components/dashboard/admin-plan-select";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/dashboard/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const used = (n: number, max: number) =>
  `${n} / ${Number.isFinite(max) ? max : "∞"}`;

export default async function AdminPage() {
  await requireAdmin();

  const users = await db.select().from(user).orderBy(user.createdAt);

  const eventCounts = new Map(
    (
      await db
        .select({ hostId: eventType.hostId, n: count() })
        .from(eventType)
        .groupBy(eventType.hostId)
    ).map((r) => [r.hostId, Number(r.n)])
  );
  const { start, end } = monthBoundsUtc();
  const bookingCounts = new Map(
    (
      await db
        .select({ hostId: booking.hostId, n: count() })
        .from(booking)
        .where(
          and(
            gte(booking.createdAt, start),
            lt(booking.createdAt, end),
            ne(booking.status, "cancelled")
          )
        )
        .groupBy(booking.hostId)
    ).map((r) => [r.hostId, Number(r.n)])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Admin
        </h1>
        <p className="text-muted-foreground">
          Every account, with its tier and usage. Switch a tier to test upgrades
          and downgrades.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Tier changes apply instantly and skip Stripe. If an account has a
            real subscription, its next webhook will overwrite the change.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Plan</th>
                <th className="py-2 pr-4 font-medium">Events</th>
                <th className="py-2 pr-4 font-medium">Bookings / mo</th>
                <th className="py-2 font-medium">Stripe Connect</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => {
                const limits = planLimits(u.plan);
                return (
                  <tr key={u.id} className="align-top">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2 font-medium">
                        {u.name}
                        {u.role === "admin" && <Badge>Admin</Badge>}
                      </div>
                      <div className="text-muted-foreground">{u.email}</div>
                      {u.username && (
                        <Link
                          href={`/${u.username}`}
                          target="_blank"
                          className="text-xs text-teal-800 underline"
                        >
                          /{u.username}
                        </Link>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <AdminPlanSelect userId={u.id} plan={u.plan} />
                    </td>
                    <td className="py-3 pr-4">
                      {used(eventCounts.get(u.id) ?? 0, limits.maxEventTypes)}
                    </td>
                    <td className="py-3 pr-4">
                      {used(
                        bookingCounts.get(u.id) ?? 0,
                        limits.maxBookingsPerMonth
                      )}
                    </td>
                    <td className="py-3">
                      <StatusPill tone={u.stripeConnectOnboarded ? "green" : "slate"}>
                        {u.stripeConnectOnboarded ? "Connected" : "Not connected"}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
