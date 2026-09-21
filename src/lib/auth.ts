import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://127.0.0.1:43123",
    process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:43123",
  ].filter(Boolean),
  user: {
    additionalFields: {
      timezone: {
        type: "string",
        required: false,
        defaultValue: "America/New_York",
        input: true,
      },
      bio: {
        type: "string",
        required: false,
        input: true,
      },
      plan: {
        type: "string",
        required: false,
        defaultValue: "free",
        input: false,
      },
      stripeCustomerId: {
        type: "string",
        required: false,
        input: false,
      },
      stripeConnectAccountId: {
        type: "string",
        required: false,
        input: false,
      },
      stripeConnectOnboarded: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      brandPrimaryColor: {
        type: "string",
        required: false,
        input: true,
      },
      brandLogoUrl: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (u) => /^[a-zA-Z0-9_]+$/.test(u),
    }),
    nextCookies(),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (created) => {
          // Default Mon–Fri 9–17 availability + host settings
          const hostId = created.id;
          const days = [1, 2, 3, 4, 5];
          for (const dayOfWeek of days) {
            await db.insert(schema.availabilityRule).values({
              id: nanoid(),
              hostId,
              dayOfWeek,
              startTime: "09:00",
              endTime: "17:00",
            });
          }
          await db.insert(schema.hostSettings).values({
            hostId,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 15,
            minNoticeMinutes: 120,
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;

export async function getSession() {
  const { headers } = await import("next/headers");
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function getUserByUsername(username: string) {
  const rows = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.username, username.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}
