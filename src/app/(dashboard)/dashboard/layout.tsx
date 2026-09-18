import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { planLimits } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/events", label: "Event types" },
  { href: "/dashboard/availability", label: "Availability" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");

  const limits = planLimits(u.plan);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="font-[family-name:var(--font-display)] text-xl font-semibold text-teal-950"
            >
              Windsurf
            </Link>
            <Badge variant="secondary">{limits.label}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {u.username && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/${u.username}`} target="_blank">
                  Public page
                </Link>
              </Button>
            )}
            <span className="hidden text-muted-foreground sm:inline">
              {u.email}
            </span>
            <SignOutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-teal-50 hover:text-teal-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
