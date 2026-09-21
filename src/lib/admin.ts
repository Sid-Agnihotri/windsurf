import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getSession } from "@/lib/auth";

/** The signed-in user's row if they are an admin, else null. Role is read from the DB, not the session. */
async function getAdmin() {
  const session = await getSession();
  if (!session?.user) return null;
  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  return u?.role === "admin" ? u : null;
}

/** For server components: 404s for everyone who isn't an admin so the page's existence isn't revealed. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}

/** For server actions: throws for non-admins. */
export async function assertAdmin() {
  const admin = await getAdmin();
  if (!admin) throw new Error("FORBIDDEN");
  return admin;
}
