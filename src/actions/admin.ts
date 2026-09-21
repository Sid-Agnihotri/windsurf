"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, type Plan } from "@/db/schema";
import { assertAdmin } from "@/lib/admin";

const PLANS: Plan[] = ["free", "pro", "expert"];

/**
 * Sets a user's tier directly. Does not touch Stripe: a real subscription's
 * next webhook will overwrite this, so it's a testing tool.
 */
export async function setUserPlan(userId: string, plan: Plan) {
  await assertAdmin();
  if (!PLANS.includes(plan)) return { error: "Invalid plan." };

  const updated = await db
    .update(user)
    .set({ plan, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  if (updated.length === 0) return { error: "User not found." };

  // Layout too, so the plan badge updates when an admin changes their own tier.
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
