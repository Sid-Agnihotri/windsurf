import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CalendarCard } from "@/components/dashboard/calendar-card";
import { CalendarResultAlert } from "@/components/dashboard/calendar-result-alert";

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const { calendar } = await searchParams;

  return (
    <div className="max-w-2xl space-y-6">
      <CalendarResultAlert result={calendar} />
      <CalendarCard userId={session.user.id} />
    </div>
  );
}
