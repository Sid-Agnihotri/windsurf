import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { generateUsername } from "@/lib/username";
import { validTimeZone } from "@/lib/timezones";
import {
  CALENDAR_SCOPE,
  providerConfigured,
} from "@/lib/social-providers";

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
  // Google and Microsoft each appear once their credentials are set. They ask for
  // calendar access up front so one consent screen covers sign-in and the calendar.
  // Signing in with either creates the account if there isn't one yet.
  socialProviders: {
    ...(providerConfigured("google") && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        scope: [CALENDAR_SCOPE.google],
        // Needed to get a refresh token, so calendar access outlives the first hour.
        accessType: "offline" as const,
      },
    }),
    ...(providerConfigured("microsoft") && {
      microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        // "common" accepts both personal (Outlook.com) and work/school accounts.
        tenantId: process.env.MICROSOFT_TENANT_ID || "common",
        scope: [CALENDAR_SCOPE.microsoft],
      },
    }),
  },
  account: {
    accountLinking: {
      // A signed-in host may connect a Google/Microsoft account under a different email
      // (say a work calendar). Signing in with one that matches an unverified password
      // account is still refused, so nobody can claim an email they haven't proven.
      allowDifferentEmails: true,
    },
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
        // Social sign-ups arrive without a username, but every host needs one for their public URL.
        before: async (incoming, context) => {
          const fields = incoming as { username?: string | null; timezone?: string | null };
          const changes: Record<string, string> = {};
          if (!fields.username) {
            const username = await generateUsername(
              incoming.email,
              incoming.name,
              async (candidate) =>
                (
                  await db
                    .select({ id: schema.user.id })
                    .from(schema.user)
                    .where(eq(schema.user.username, candidate))
                    .limit(1)
                ).length > 0
            );
            changes.username = username;
            changes.displayUsername = username;
          }
          // Social sign-ups don't send a timezone, but the buttons leave the browser's in a
          // cookie. There is deliberately no schema default, so "missing" is detectable here.
          if (!fields.timezone) {
            changes.timezone =
              validTimeZone(context?.getCookie("browser_tz")) ?? "America/New_York";
          }
          if (Object.keys(changes).length === 0) return;
          return { data: { ...incoming, ...changes } };
        },
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
