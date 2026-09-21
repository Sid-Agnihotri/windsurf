import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** Plan tiers mirrored from Stripe subscription webhooks */
export type Plan = "free" | "pro" | "expert";
/** "admin" unlocks /dashboard/admin; only ever set directly in the DB (never via sign-up input) */
export type UserRole = "user" | "admin";
export type PricingMode = "free" | "paid" | "deposit";
export type LocationType = "in_person" | "phone" | "link";
/** How the guest pays at booking time: none = free, card = online (Stripe), cash = in person */
export type PaymentMethod = "none" | "card" | "cash";
export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "completed";

// ——— Better Auth core tables ———

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    // username plugin
    username: text("username").unique(),
    displayUsername: text("display_username"),
    // host profile
    timezone: text("timezone").notNull().default("America/New_York"),
    bio: text("bio"),
    plan: text("plan").$type<Plan>().notNull().default("free"),
    role: text("role").$type<UserRole>().notNull().default("user"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeConnectAccountId: text("stripe_connect_account_id"),
    stripeConnectOnboarded: integer("stripe_connect_onboarded", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    // Expert branding (ignored unless plan === expert)
    brandPrimaryColor: text("brand_primary_color"),
    brandLogoUrl: text("brand_logo_url"),
  },
  (t) => [uniqueIndex("user_username_uidx").on(t.username)]
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (t) => [index("account_user_id_idx").on(t.userId)]
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
});

// ——— Product tables ———

export const eventType = sqliteTable(
  "event_type",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    locationType: text("location_type")
      .$type<LocationType>()
      .notNull()
      .default("in_person"),
    locationValue: text("location_value"),
    pricingMode: text("pricing_mode")
      .$type<PricingMode>()
      .notNull()
      .default("free"),
    /** Amount in cents for paid full price */
    priceCents: integer("price_cents").notNull().default(0),
    /** Deposit amount in cents when pricingMode = deposit */
    depositCents: integer("deposit_cents").notNull().default(0),
    tipsEnabled: integer("tips_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    /** Guests may choose to pay in person (cash) instead of online */
    acceptCash: integer("accept_cash", { mode: "boolean" })
      .notNull()
      .default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (t) => [
    uniqueIndex("event_type_host_slug_uidx").on(t.hostId, t.slug),
    index("event_type_host_id_idx").on(t.hostId),
  ]
);

/** Weekly recurring windows: dayOfWeek 0=Sun … 6=Sat, times as "HH:mm" in host TZ */
export const availabilityRule = sqliteTable(
  "availability_rule",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
  },
  (t) => [index("availability_rule_host_id_idx").on(t.hostId)]
);

/** Date-specific overrides: unavailable all day, or custom hours JSON */
export const availabilityOverride = sqliteTable(
  "availability_override",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD in host timezone */
    date: text("date").notNull(),
    unavailable: integer("unavailable", { mode: "boolean" })
      .notNull()
      .default(false),
    /** JSON array of {startTime,endTime} when custom hours */
    windowsJson: text("windows_json"),
  },
  (t) => [
    uniqueIndex("availability_override_host_date_uidx").on(t.hostId, t.date),
  ]
);

export const hostSettings = sqliteTable("host_settings", {
  hostId: text("host_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
  bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
  minNoticeMinutes: integer("min_notice_minutes").notNull().default(120),
  /** Guests may cancel/reschedule themselves until this many hours before the start; 0 = until it starts */
  changeNoticeHours: integer("change_notice_hours").notNull().default(24),
});

export const booking = sqliteTable(
  "booking",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventTypeId: text("event_type_id")
      .notNull()
      .references(() => eventType.id, { onDelete: "cascade" }),
    guestName: text("guest_name").notNull(),
    guestEmail: text("guest_email").notNull(),
    guestNote: text("guest_note"),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").$type<BookingStatus>().notNull().default("confirmed"),
    paymentMethod: text("payment_method")
      .$type<PaymentMethod>()
      .notNull()
      .default("none"),
    /** Full service price snapshotted at booking time (excludes tip) */
    totalCents: integer("total_cents").notNull().default(0),
    /** Portion charged online at booking: price, or deposit; 0 for cash/free (excludes tip) */
    dueNowCents: integer("due_now_cents").notNull().default(0),
    /** Money actually received so far (online payment + tip, plus anything marked paid in person) */
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),
    tipCents: integer("tip_cents").notNull().default(0),
    isDeposit: integer("is_deposit", { mode: "boolean" }).notNull().default(false),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    /** Secret in the guest's manage link; null for bookings made before the feature existed */
    manageToken: text("manage_token"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (t) => [
    index("booking_host_id_idx").on(t.hostId),
    index("booking_host_start_idx").on(t.hostId, t.startAt),
    index("booking_event_type_id_idx").on(t.eventTypeId),
    uniqueIndex("booking_manage_token_uidx").on(t.manageToken),
  ]
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  eventTypes: many(eventType),
  availabilityRules: many(availabilityRule),
  availabilityOverrides: many(availabilityOverride),
  bookings: many(booking),
  settings: one(hostSettings),
}));

export const eventTypeRelations = relations(eventType, ({ one, many }) => ({
  host: one(user, { fields: [eventType.hostId], references: [user.id] }),
  bookings: many(booking),
}));

export const bookingRelations = relations(booking, ({ one }) => ({
  host: one(user, { fields: [booking.hostId], references: [user.id] }),
  eventType: one(eventType, {
    fields: [booking.eventTypeId],
    references: [eventType.id],
  }),
}));

export type User = typeof user.$inferSelect;
export type EventType = typeof eventType.$inferSelect;
export type Booking = typeof booking.$inferSelect;
export type AvailabilityRule = typeof availabilityRule.$inferSelect;
export type AvailabilityOverride = typeof availabilityOverride.$inferSelect;
export type HostSettings = typeof hostSettings.$inferSelect;
