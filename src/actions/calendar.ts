"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { hostSettings, type CalendarProvider } from "@/db/schema";

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

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
