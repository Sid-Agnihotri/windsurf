"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { booking, hostSettings, type CalendarProvider } from "@/db/schema";
import { syncBookingToCalendar } from "@/lib/calendar";
import { countUnsyncedBookings } from "@/lib/calendar-status";

const CHOICES = ["auto", "google", "microsoft", "off"] as const;
export type CalendarChoice = (typeof CHOICES)[number];

/**
 * Which connected calendar Windsurf checks for conflicts and adds bookings to.
 * "auto" uses the first one connected; "off" stops using a calendar without disconnecting it.
 */
export async function setCalendarChoice(choice: CalendarChoice) {
  const session = await getSession();
  if (!session?.user) return { error: "Please sign in again." };
  if (!CHOICES.includes(choice)) return { error: "Invalid choice." };

  const calendarProvider: CalendarProvider | "off" | null =
    choice === "auto" ? null : choice;
  await db
    .insert(hostSettings)
    .values({ hostId: session.user.id, calendarProvider })
    .onConflictDoUpdate({
      target: hostSettings.hostId,
      set: { calendarProvider },
    });

  revalidatePath("/dashboard/settings/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Adds upcoming confirmed bookings that never reached the host's calendar (made before
 * they connected, or when Google/Outlook was unreachable). Capped so one click stays quick.
 */
export async function syncMissingBookings() {
  const session = await getSession();
  if (!session?.user) return { error: "Please sign in again." };

  const before = await countUnsyncedBookings(session.user.id);
  const missing = await db
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(
        eq(booking.hostId, session.user.id),
        eq(booking.status, "confirmed"),
        gte(booking.startAt, new Date()),
        isNull(booking.calendarEventId)
      )
    )
    .orderBy(asc(booking.startAt))
    .limit(25);
  for (const { id } of missing) await syncBookingToCalendar(id);

  const remaining = await countUnsyncedBookings(session.user.id);
  revalidatePath("/dashboard");
  return { ok: true, added: before - remaining, remaining };
}
