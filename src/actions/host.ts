"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  availabilityOverride,
  availabilityRule,
  booking,
  eventType,
  hostSettings,
  user,
  type PricingMode,
  type LocationType,
  type PaymentMethod,
  type User,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  canAcceptMoreBookings,
  canCreateEventType,
  canUsePaidPricing,
  planLimits,
  stripePriceIdForPlan,
} from "@/lib/plans";
import { generateSlots, monthBoundsUtc } from "@/lib/slots";
import { validTimeZone } from "@/lib/timezones";
import {
  MAX_TIME_OFF_DAYS,
  expandDateRange,
  validateWeeklySchedule,
  validateWindows,
} from "@/lib/availability-input";
import {
  busyForDate,
  removeBookingFromCalendar,
  syncBookingToCalendar,
} from "@/lib/calendar";
import {
  createBookingCheckout,
  createConnectOnboardingLink,
  createSubscriptionCheckout,
} from "@/lib/stripe";
import {
  sendBookingCancelled,
  sendBookingConfirmation,
  sendBookingRescheduled,
} from "@/lib/email";
import { balanceNote, formatMoney } from "@/lib/money";
import { loadAvailability, type Queryable } from "@/lib/availability-data";
import { calendarBusyForMove, listMoveSlots, moveBooking } from "@/lib/reschedule";
import { manageUrl } from "@/lib/manage";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addMinutes } from "date-fns";

async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!u) redirect("/sign-in");
  return u;
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "event";
}

/** Integer in [min, max]; blank input uses `fallback`, anything else out of range or non-integer returns null. */
function parseIntInRange(
  raw: FormDataEntryValue | null,
  min: number,
  max: number,
  fallback: number
): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return fallback;
  const n = Number(s);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/** Non-negative dollar amount → cents, or null if not a finite number ≥ 0. */
function parseDollarsToCents(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return 0;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

const PRICING_MODES: PricingMode[] = ["free", "paid", "deposit"];
const LOCATION_TYPES: LocationType[] = ["in_person", "phone", "link"];

function parsePricingMode(raw: FormDataEntryValue | null): PricingMode | null {
  const s = String(raw || "free");
  return PRICING_MODES.includes(s as PricingMode) ? (s as PricingMode) : null;
}

function parseLocationType(
  raw: FormDataEntryValue | null,
  fallback: LocationType
): LocationType | null {
  const s = String(raw || fallback);
  return LOCATION_TYPES.includes(s as LocationType) ? (s as LocationType) : null;
}

/**
 * Validates the pricing-related event form fields. Card payments and tips go
 * through Stripe Connect; an event that accepts cash can be saved without it.
 */
function parsePricing(u: User, formData: FormData) {
  const pricingMode = parsePricingMode(formData.get("pricingMode"));
  if (!pricingMode) return { error: "Invalid pricing mode." };

  const priceCents = parseDollarsToCents(formData.get("price"));
  const depositCents = parseDollarsToCents(formData.get("deposit"));
  if (priceCents === null || depositCents === null) {
    return { error: "Price and deposit must be non-negative amounts." };
  }
  if (pricingMode === "paid" && priceCents <= 0) {
    return { error: "Set a price above $0 for a paid event." };
  }
  if (pricingMode === "deposit") {
    if (priceCents <= 0) return { error: "Set the full price for a deposit event." };
    if (depositCents <= 0 || depositCents > priceCents) {
      return { error: "Deposit must be above $0 and no more than the full price." };
    }
  }

  const tipsEnabled = formData.get("tipsEnabled") === "on";
  const acceptCash = pricingMode !== "free" && formData.get("acceptCash") === "on";

  const paidGate = canUsePaidPricing(u.plan, pricingMode, tipsEnabled);
  if (!paidGate.ok) return { error: paidGate.reason };

  const needsCard = tipsEnabled || (pricingMode !== "free" && !acceptCash);
  if (needsCard && !u.stripeConnectOnboarded) {
    return {
      error:
        "Connect Stripe in Billing to take card payments or tips, or turn on cash so guests can pay in person.",
    };
  }

  return { pricingMode, priceCents, depositCents, tipsEnabled, acceptCash };
}

export async function updateProfile(formData: FormData) {
  const u = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "")
    .trim()
    .toLowerCase();
  const timezone = validTimeZone(String(formData.get("timezone") || u.timezone));
  const bio = String(formData.get("bio") || "").trim() || null;
  const brandPrimaryColor =
    String(formData.get("brandPrimaryColor") || "").trim() || null;
  const brandLogoUrl = String(formData.get("brandLogoUrl") || "").trim() || null;

  if (!timezone) return { error: "Choose a valid timezone." };
  if (!name || !username || !/^[a-z0-9_]{3,30}$/.test(username)) {
    return { error: "Valid name and username (3–30 alphanumeric/_) required." };
  }

  const taken = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.username, username), ne(user.id, u.id)))
    .limit(1);
  if (taken.length) return { error: "Username is taken." };

  await db
    .update(user)
    .set({
      name,
      username,
      displayUsername: username,
      timezone,
      bio,
      brandPrimaryColor,
      brandLogoUrl,
      updatedAt: new Date(),
    })
    .where(eq(user.id, u.id));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function createEventType(formData: FormData) {
  const u = await requireUser();
  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(eventType)
    .where(eq(eventType.hostId, u.id));

  const gate = canCreateEventType(u.plan, Number(existing));
  if (!gate.ok) return { error: gate.reason };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { error: "Title is required." };

  const pricing = parsePricing(u, formData);
  if ("error" in pricing) return { error: pricing.error };
  const locationType = parseLocationType(formData.get("locationType"), "in_person");
  if (!locationType) return { error: "Invalid location type." };
  const durationMinutes = parseIntInRange(formData.get("durationMinutes"), 5, 480, 30);
  if (durationMinutes === null) {
    return { error: "Duration must be a whole number between 5 and 480 minutes." };
  }

  let slug = slugify(String(formData.get("slug") || title));
  const clash = await db
    .select()
    .from(eventType)
    .where(and(eq(eventType.hostId, u.id), eq(eventType.slug, slug)))
    .limit(1);
  if (clash.length) slug = `${slug}-${nanoid(4)}`;

  const id = nanoid();
  await db.insert(eventType).values({
    id,
    hostId: u.id,
    title,
    slug,
    description: String(formData.get("description") || "").trim() || null,
    durationMinutes,
    locationType,
    locationValue: String(formData.get("locationValue") || "").trim() || null,
    ...pricing,
    active: formData.get("active") !== "off",
  });

  revalidatePath("/dashboard/events");
  redirect("/dashboard/events");
}

export async function updateEventType(id: string, formData: FormData) {
  const u = await requireUser();
  const [evt] = await db
    .select()
    .from(eventType)
    .where(and(eq(eventType.id, id), eq(eventType.hostId, u.id)))
    .limit(1);
  if (!evt) return { error: "Not found" };

  const pricing = parsePricing(u, formData);
  if ("error" in pricing) return { error: pricing.error };
  const locationType = parseLocationType(
    formData.get("locationType"),
    evt.locationType
  );
  if (!locationType) return { error: "Invalid location type." };
  const durationMinutes = parseIntInRange(
    formData.get("durationMinutes"),
    5,
    480,
    evt.durationMinutes
  );
  if (durationMinutes === null) {
    return { error: "Duration must be a whole number between 5 and 480 minutes." };
  }

  await db
    .update(eventType)
    .set({
      title: String(formData.get("title") || evt.title).trim(),
      description: String(formData.get("description") || "").trim() || null,
      durationMinutes,
      locationType,
      locationValue: String(formData.get("locationValue") || "").trim() || null,
      ...pricing,
      active: formData.get("active") === "on" || formData.get("active") === "true",
      updatedAt: new Date(),
    })
    .where(eq(eventType.id, id));

  revalidatePath("/dashboard/events");
  redirect("/dashboard/events");
}

export async function deleteEventType(id: string) {
  const u = await requireUser();
  await db
    .delete(eventType)
    .where(and(eq(eventType.id, id), eq(eventType.hostId, u.id)));
  revalidatePath("/dashboard/events");
  redirect("/dashboard/events");
}

const SETTINGS_PATH = "/dashboard/settings/availability";

/** Replaces the weekly hours. `input` is [{ day: 0-6 (Sun = 0), windows: [{ startTime, endTime }] }]. */
export async function saveWeeklyHours(input: unknown) {
  const u = await requireUser();
  const result = validateWeeklySchedule(input);
  if ("error" in result) return { error: result.error };

  // Synchronous transaction, so a failed insert can't leave the week half-replaced.
  db.transaction((tx) => {
    tx.delete(availabilityRule).where(eq(availabilityRule.hostId, u.id)).run();
    for (const { day, windows } of result.days) {
      for (const { startTime, endTime } of windows) {
        tx.insert(availabilityRule)
          .values({ id: nanoid(), hostId: u.id, dayOfWeek: day, startTime, endTime })
          .run();
      }
    }
  });

  revalidatePath(SETTINGS_PATH);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Buffers, minimum notice and how long guests may still change their booking. */
export async function saveBookingRules(input: {
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  changeNoticeHours: number;
}) {
  const u = await requireUser();
  const whole = (n: unknown, max: number) =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
  const { bufferBeforeMinutes, bufferAfterMinutes, minNoticeMinutes, changeNoticeHours } =
    input ?? ({} as typeof input);
  if (!whole(bufferBeforeMinutes, 1440) || !whole(bufferAfterMinutes, 1440)) {
    return { error: "Buffers must be between 0 minutes and 24 hours." };
  }
  if (!whole(minNoticeMinutes, 60 * 24 * 365)) {
    return { error: "Minimum notice must be a whole number of minutes, up to a year." };
  }
  if (!whole(changeNoticeHours, 720)) {
    return { error: "The guest change cutoff must be between 0 and 720 hours." };
  }

  const values = { bufferBeforeMinutes, bufferAfterMinutes, minNoticeMinutes, changeNoticeHours };
  await db
    .insert(hostSettings)
    .values({ hostId: u.id, ...values })
    .onConflictDoUpdate({ target: hostSettings.hostId, set: values });

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

/**
 * Blocks a day or a run of days, or replaces the usual hours on them. Existing
 * bookings are not touched; the result says how many fall inside the range.
 */
export async function addTimeOff(input: {
  startDate: string;
  endDate: string;
  mode: "day_off" | "custom_hours";
  startTime?: string;
  endTime?: string;
}) {
  const u = await requireUser();
  const today = formatInTimeZone(new Date(), u.timezone, "yyyy-MM-dd");
  const range = expandDateRange(input?.startDate, input?.endDate, today);
  if ("error" in range) return { error: range.error };

  const unavailable = input.mode === "day_off";
  let windowsJson: string | null = null;
  if (!unavailable) {
    const w = validateWindows([{ startTime: input.startTime, endTime: input.endTime }]);
    if ("error" in w) return { error: w.error };
    windowsJson = JSON.stringify(w.windows);
  } else if (input.mode !== "day_off") {
    return { error: "Choose all day or custom hours." };
  }

  db.transaction((tx) => {
    for (const date of range.dates) {
      tx.insert(availabilityOverride)
        .values({ id: nanoid(), hostId: u.id, date, unavailable, windowsJson })
        .onConflictDoUpdate({
          target: [availabilityOverride.hostId, availabilityOverride.date],
          set: { unavailable, windowsJson },
        })
        .run();
    }
  });

  const from = fromZonedTime(`${range.dates[0]} 00:00:00`, u.timezone);
  const to = fromZonedTime(`${range.dates[range.dates.length - 1]} 23:59:59`, u.timezone);
  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(booking)
    .where(
      and(
        eq(booking.hostId, u.id),
        eq(booking.status, "confirmed"),
        gte(booking.startAt, from),
        lt(booking.startAt, to)
      )
    );

  revalidatePath(SETTINGS_PATH);
  return { ok: true, days: range.dates.length, existingBookings: Number(existing) };
}

/** Removes one or more time-off days (the ids of a grouped line in the list). */
export async function removeTimeOff(ids: string[]) {
  const u = await requireUser();
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_TIME_OFF_DAYS) {
    return { error: "Nothing to remove." };
  }
  await db
    .delete(availabilityOverride)
    .where(
      and(
        eq(availabilityOverride.hostId, u.id),
        inArray(availabilityOverride.id, ids.map(String))
      )
    );
  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

export async function cancelBooking(id: string) {
  const u = await requireUser();
  const [b] = await db
    .select({ booking, title: eventType.title })
    .from(booking)
    .innerJoin(eventType, eq(booking.eventTypeId, eventType.id))
    .where(and(eq(booking.id, id), eq(booking.hostId, u.id)))
    .limit(1);
  if (!b) return { error: "Not found" };
  if (b.booking.status === "cancelled") return { ok: true };

  await db
    .update(booking)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(booking.id, id));
  await removeBookingFromCalendar(id);

  await sendBookingCancelled({
    guestEmail: b.booking.guestEmail,
    guestName: b.booking.guestName,
    hostEmail: u.email,
    hostName: u.name,
    eventTitle: b.title,
    whenLabel: formatInTimeZone(
      b.booking.startAt,
      u.timezone,
      "EEE, MMM d yyyy 'at' h:mm a zzz"
    ),
    cancelledBy: "host",
    guestNote:
      b.booking.amountPaidCents > 0
        ? `You paid ${formatMoney(b.booking.amountPaidCents)}. Contact ${u.name} about a refund.`
        : undefined,
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** The host's own booking with its event and host row, or undefined. */
function findHostBooking(q: Queryable, id: string, hostId: string) {
  return q
    .select({ booking, evt: eventType, host: user })
    .from(booking)
    .innerJoin(eventType, eq(booking.eventTypeId, eventType.id))
    .innerJoin(user, eq(booking.hostId, user.id))
    .where(and(eq(booking.id, id), eq(booking.hostId, hostId)))
    .get();
}

/** Why a host can't move this booking, or null if they can. */
function hostMoveBlocked(b: { status: string; startAt: Date }) {
  if (b.status !== "confirmed") return "Only confirmed bookings can be rescheduled.";
  if (b.startAt <= new Date()) return "This appointment has already passed.";
  return null;
}

/** Open times a host could move one of their bookings to on `date` (YYYY-MM-DD in their timezone). */
export async function getHostRescheduleSlots(bookingId: string, date: string) {
  const none = [] as { startISO: string }[];
  const u = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date.", slots: none };
  const found = findHostBooking(db, bookingId, u.id);
  if (!found) return { error: "Booking not found.", slots: none };
  const message = hostMoveBlocked(found.booking);
  if (message) return { error: message, slots: none };

  return {
    slots: listMoveSlots(found, date, await calendarBusyForMove(found, date)).map(
      (s) => ({ startISO: s.startISO })
    ),
    timeZone: u.timezone,
  };
}

/** Host moves a confirmed booking to another open time; the guest is emailed. No guest cutoff applies. */
export async function rescheduleBookingAsHost(bookingId: string, startISO: string) {
  const u = await requireUser();
  const startAt = new Date(startISO);
  if (Number.isNaN(startAt.getTime())) return { error: "Invalid time." };

  // Read the calendar first: the move itself is a synchronous transaction.
  const current = findHostBooking(db, bookingId, u.id);
  const externalBusy = current
    ? await calendarBusyForMove(
        current,
        formatInTimeZone(startAt, u.timezone, "yyyy-MM-dd")
      )
    : undefined;

  const outcome = moveBooking({
    startAt,
    externalBusy,
    notFoundMessage: "Booking not found.",
    find: (q) => findHostBooking(q, bookingId, u.id),
    blocked: ({ booking: b }) => hostMoveBlocked(b),
  });
  if ("error" in outcome) return { error: outcome.error };

  const { booking: b, evt } = outcome.found;
  await syncBookingToCalendar(b.id);
  const label = (d: Date) =>
    formatInTimeZone(d, u.timezone, "EEE, MMM d yyyy 'at' h:mm a zzz");
  await sendBookingRescheduled({
    guestEmail: b.guestEmail,
    guestName: b.guestName,
    hostEmail: u.email,
    hostName: u.name,
    eventTitle: evt.title,
    oldWhenLabel: label(b.startAt),
    whenLabel: label(startAt),
    movedBy: "host",
    manageUrl: b.manageToken ? manageUrl(b.manageToken) : undefined,
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Host records that the guest paid the remaining balance (e.g. cash) in person. */
export async function markBookingPaid(id: string) {
  const u = await requireUser();
  const [b] = await db
    .select()
    .from(booking)
    .where(and(eq(booking.id, id), eq(booking.hostId, u.id)))
    .limit(1);
  if (!b) return { error: "Not found" };
  if (b.status !== "confirmed" && b.status !== "completed") {
    return { error: "Only confirmed bookings can be marked as paid." };
  }

  await db
    .update(booking)
    .set({
      amountPaidCents: Math.max(b.amountPaidCents, b.totalCents + b.tipCents),
      updatedAt: new Date(),
    })
    .where(eq(booking.id, id));
  revalidatePath("/dashboard/bookings");
  return { ok: true };
}

export async function startPlanCheckout(plan: "pro" | "expert") {
  const u = await requireUser();
  const priceId = stripePriceIdForPlan(plan);
  const result = await createSubscriptionCheckout({
    customerId: u.stripeCustomerId,
    customerEmail: u.email,
    userId: u.id,
    plan,
    priceId,
  });
  if (!u.stripeCustomerId && result.sessionId && !result.mocked) {
    // customer created inside helper — refresh from webhook; mock sets later
  }
  redirect(result.url);
}

export async function startConnectOnboarding() {
  const u = await requireUser();
  const result = await createConnectOnboardingLink({
    accountId: u.stripeConnectAccountId,
    userId: u.id,
    email: u.email,
  });
  if (result.accountId !== u.stripeConnectAccountId) {
    await db
      .update(user)
      .set({
        stripeConnectAccountId: result.accountId,
        updatedAt: new Date(),
      })
      .where(eq(user.id, u.id));
  }
  redirect(result.url);
}

export async function createGuestBooking(input: {
  username: string;
  eventSlug: string;
  startISO: string;
  guestName: string;
  guestEmail: string;
  guestNote?: string;
  tipCents?: number;
  /** Only relevant for priced events; defaults to card. */
  paymentMethod?: "card" | "cash";
}) {
  const [host] = await db
    .select()
    .from(user)
    .where(eq(user.username, input.username.toLowerCase()))
    .limit(1);
  if (!host) return { error: "Host not found" };

  const [evt] = await db
    .select()
    .from(eventType)
    .where(
      and(
        eq(eventType.hostId, host.id),
        eq(eventType.slug, input.eventSlug),
        eq(eventType.active, true)
      )
    )
    .limit(1);
  if (!evt) return { error: "Event not found" };

  const tipCents = Math.max(0, Math.round(input.tipCents || 0));
  if (tipCents > 0 && !evt.tipsEnabled) {
    return { error: "Tips are not enabled for this event." };
  }
  if (
    (evt.pricingMode !== "free" || tipCents > 0) &&
    !planLimits(host.plan).paidEvents
  ) {
    return {
      error: `This host cannot accept paid bookings on the ${planLimits(host.plan).label} plan.`,
    };
  }

  const startAt = new Date(input.startISO);
  if (Number.isNaN(startAt.getTime())) {
    return { error: "Invalid start time." };
  }

  const isPriced = evt.pricingMode !== "free";
  const paymentMethod: PaymentMethod =
    !isPriced && tipCents === 0
      ? "none"
      : input.paymentMethod === "cash"
        ? "cash"
        : "card";

  if (paymentMethod === "cash") {
    if (!isPriced || !evt.acceptCash) {
      return { error: "This host doesn't accept cash for this event." };
    }
    if (tipCents > 0) {
      return {
        error: "Tips are paid by card. Remove the tip or choose to pay by card.",
      };
    }
  }
  if (
    paymentMethod === "card" &&
    (!host.stripeConnectAccountId || !host.stripeConnectOnboarded)
  ) {
    return {
      error: evt.acceptCash
        ? "This host can't take card payments yet. Choose to pay in person instead."
        : "This host can't take card payments yet.",
    };
  }
  const needsCheckout = paymentMethod === "card";

  // Full service price, the part charged online now, and the rest owed in person.
  const totalCents = !isPriced
    ? 0
    : evt.pricingMode === "deposit"
      ? Math.max(evt.priceCents, evt.depositCents)
      : evt.priceCents;
  const isDeposit = evt.pricingMode === "deposit";
  const amountCents = needsCheckout
    ? isDeposit
      ? evt.depositCents
      : isPriced
        ? evt.priceCents
        : 0
    : 0;
  const balanceDueCents = totalCents - amountCents;

  const guestName = input.guestName.trim();
  const guestEmail = input.guestEmail.trim().toLowerCase();
  const endAt = addMinutes(startAt, evt.durationMinutes);
  const dateInHostTz = formatInTimeZone(startAt, host.timezone, "yyyy-MM-dd");
  const { start, end } = monthBoundsUtc();

  // Availability check + insert run in one IMMEDIATE transaction so concurrent
  // requests for the same slot are serialized (better-sqlite3 is synchronous, so
  // the callback must not await). A Postgres port needs a serializable
  // transaction or an advisory lock on the host here.
  const externalBusy = await busyForDate({
    hostId: host.id,
    date: dateInHostTz,
    timeZone: host.timezone,
  });
  const id = nanoid();
  const manageToken = nanoid(32);
  const reserved = db.transaction(
    (tx) => {
      const monthCount =
        tx
          .select({ value: count() })
          .from(booking)
          .where(
            and(
              eq(booking.hostId, host.id),
              gte(booking.createdAt, start),
              lt(booking.createdAt, end),
              ne(booking.status, "cancelled")
            )
          )
          .get()?.value ?? 0;
      const cap = canAcceptMoreBookings(host.plan, Number(monthCount));
      if (!cap.ok) return { error: cap.reason };

      const { settings, rules, overrides, existing } = loadAvailability(
        tx,
        host.id
      );

      const slots = generateSlots({
        date: dateInHostTz,
        durationMinutes: evt.durationMinutes,
        timeZone: host.timezone,
        rules,
        overrides,
        settings,
        existingBookings: existing,
        externalBusy,
      });
      if (!slots.some((s) => s.startISO === startAt.toISOString())) {
        return {
          error: "That slot is no longer available. Pick another time.",
        };
      }

      tx.insert(booking)
        .values({
          id,
          hostId: host.id,
          eventTypeId: evt.id,
          guestName,
          guestEmail,
          guestNote: input.guestNote?.trim() || null,
          startAt,
          endAt,
          status: needsCheckout ? "pending_payment" : "confirmed",
          paymentMethod,
          totalCents,
          dueNowCents: amountCents,
          // Filled in when the online payment is confirmed (or marked paid in person).
          amountPaidCents: 0,
          tipCents,
          isDeposit,
          manageToken,
          expiresAt: needsCheckout
            ? new Date(Date.now() + 30 * 60 * 1000)
            : undefined,
        })
        .run();
      return { error: null };
    },
    { behavior: "immediate" }
  );
  if (reserved.error) return { error: reserved.error };

  if (!needsCheckout) {
    await syncBookingToCalendar(id);
    const whenLabel = formatInTimeZone(
      startAt,
      host.timezone,
      "EEE, MMM d yyyy 'at' h:mm a zzz"
    );
    await sendBookingConfirmation({
      guestEmail,
      guestName,
      hostEmail: host.email,
      hostName: host.name,
      eventTitle: evt.title,
      whenLabel,
      paymentNote: balanceNote(balanceDueCents),
      manageUrl: manageUrl(manageToken),
    });
    return {
      ok: true,
      bookingId: id,
      checkoutUrl: null as string | null,
      balanceDueCents,
      manageUrl: manageUrl(manageToken) as string | null,
    };
  }

  let checkout;
  try {
    checkout = await createBookingCheckout({
      bookingId: id,
      hostConnectAccountId: host.stripeConnectAccountId!,
      amountCents,
      tipCents,
      eventTitle: evt.title,
      guestEmail,
      isDeposit,
    });
  } catch (err) {
    // Release the slot hold rather than leaving it pending for 30 minutes.
    console.error("createBookingCheckout failed", err);
    await db.delete(booking).where(eq(booking.id, id));
    return { error: "Could not start checkout. Please try again." };
  }

  await db
    .update(booking)
    .set({
      stripeCheckoutSessionId: checkout.sessionId,
      updatedAt: new Date(),
    })
    .where(eq(booking.id, id));

  return {
    ok: true,
    bookingId: id,
    checkoutUrl: checkout.url,
    balanceDueCents,
    manageUrl: null as string | null,
  };
}

export async function getSlotsForPublic(opts: {
  username: string;
  eventSlug: string;
  date: string;
}) {
  const [host] = await db
    .select()
    .from(user)
    .where(eq(user.username, opts.username.toLowerCase()))
    .limit(1);
  if (!host) return { error: "Host not found", slots: [] as { startISO: string }[] };

  const [evt] = await db
    .select()
    .from(eventType)
    .where(
      and(
        eq(eventType.hostId, host.id),
        eq(eventType.slug, opts.eventSlug),
        eq(eventType.active, true)
      )
    )
    .limit(1);
  if (!evt) return { error: "Event not found", slots: [] };

  const { start, end } = monthBoundsUtc();
  const [{ value: monthCount }] = await db
    .select({ value: count() })
    .from(booking)
    .where(
      and(
        eq(booking.hostId, host.id),
        gte(booking.createdAt, start),
        lt(booking.createdAt, end),
        ne(booking.status, "cancelled")
      )
    );
  const cap = canAcceptMoreBookings(host.plan, Number(monthCount));
  if (!cap.ok) {
    return { error: cap.reason, slots: [], fullyBooked: true };
  }

  const { settings, rules, overrides, existing } = loadAvailability(db, host.id);
  const externalBusy = await busyForDate({
    hostId: host.id,
    date: opts.date,
    timeZone: host.timezone,
  });

  const slots = generateSlots({
    date: opts.date,
    durationMinutes: evt.durationMinutes,
    timeZone: host.timezone,
    rules,
    overrides,
    settings,
    existingBookings: existing,
    externalBusy,
  });

  return {
    slots: slots.map((s) => ({ startISO: s.startISO })),
    timeZone: host.timezone,
  };
}
