/**
 * Creates (or resets the tier of) one admin and one demo account per plan.
 * Dev only: every account uses the password "password".
 *
 *   npm run db:migrate && npm run db:seed
 *
 * Safe to re-run: existing accounts only get their plan and role re-applied.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const PASSWORD = "password";

const ACCOUNTS = [
  { email: "admin@windsurf.test", username: "admin", name: "Admin", plan: "expert", role: "admin" },
  { email: "free@windsurf.test", username: "demo_free", name: "Demo Free", plan: "free", role: "user" },
  { email: "pro@windsurf.test", username: "demo_pro", name: "Demo Pro", plan: "pro", role: "user" },
  { email: "expert@windsurf.test", username: "demo_expert", name: "Demo Expert", plan: "expert", role: "user" },
] as const;

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed demo accounts with a default password when NODE_ENV=production.");
    process.exit(1);
  }

  // Imported after dotenv so src/db and src/lib/auth see the env vars.
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { user, session } = await import("../src/db/schema");
  const { auth } = await import("../src/lib/auth");

  const rows: Record<string, string>[] = [];

  for (const a of ACCOUNTS) {
    const [existing] = await db.select().from(user).where(eq(user.email, a.email)).limit(1);

    if (!existing) {
      // Real sign-up path: hashes the password and runs the create hook
      // (default Mon–Fri 9–5 availability + host settings).
      await auth.api.signUpEmail({
        body: { email: a.email, password: PASSWORD, name: a.name, username: a.username },
      });
    }

    const [updated] = await db
      .update(user)
      .set({ plan: a.plan, role: a.role, updatedAt: new Date() })
      .where(eq(user.email, a.email))
      .returning({ id: user.id });

    // Sign-up auto-signs-in; drop that throwaway session.
    if (!existing) await db.delete(session).where(eq(session.userId, updated.id));

    rows.push({
      email: a.email,
      password: PASSWORD,
      username: a.username,
      plan: a.plan,
      role: a.role,
      status: existing ? "reset" : "created",
    });
  }

  console.table(rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
