import type { Plan, PricingMode } from "@/db/schema";

export const PLAN_LIMITS = {
  free: {
    label: "Free",
    priceMonthlyCents: 0,
    maxEventTypes: 3,
    maxBookingsPerMonth: 5,
    paidEvents: true,
    customBranding: false,
  },
  pro: {
    label: "Pro",
    priceMonthlyCents: 1200,
    maxEventTypes: Number.POSITIVE_INFINITY,
    maxBookingsPerMonth: 100,
    paidEvents: true,
    customBranding: false,
  },
  expert: {
    label: "Expert",
    priceMonthlyCents: 2900,
    maxEventTypes: Number.POSITIVE_INFINITY,
    maxBookingsPerMonth: Number.POSITIVE_INFINITY,
    paidEvents: true,
    customBranding: true,
  },
} as const satisfies Record<
  Plan,
  {
    label: string;
    priceMonthlyCents: number;
    maxEventTypes: number;
    maxBookingsPerMonth: number;
    paidEvents: boolean;
    customBranding: boolean;
  }
>;

export function planLimits(plan: Plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function canCreateEventType(plan: Plan, currentCount: number) {
  const max = planLimits(plan).maxEventTypes;
  if (currentCount >= max) {
    return {
      ok: false as const,
      reason: `Your ${planLimits(plan).label} plan allows ${max === Number.POSITIVE_INFINITY ? "unlimited" : max} event${max === 1 ? "" : "s"}. Upgrade to add more.`,
    };
  }
  return { ok: true as const };
}

export function canUsePaidPricing(
  plan: Plan,
  pricingMode: PricingMode,
  tipsEnabled: boolean
) {
  if (pricingMode === "free" && !tipsEnabled) {
    return { ok: true as const };
  }
  if (!planLimits(plan).paidEvents) {
    return {
      ok: false as const,
      reason:
        "Paid events, deposits, and tips require Pro or Expert. Upgrade to enable payments.",
    };
  }
  return { ok: true as const };
}

export function canAcceptMoreBookings(plan: Plan, bookingsThisMonth: number) {
  const max = planLimits(plan).maxBookingsPerMonth;
  if (bookingsThisMonth >= max) {
    return {
      ok: false as const,
      reason: `This host has reached their monthly booking limit on the ${planLimits(plan).label} plan.`,
      hostReason: `You've hit ${max} bookings this month. Upgrade to accept more.`,
    };
  }
  return { ok: true as const };
}

export function canUseCustomBranding(plan: Plan) {
  return planLimits(plan).customBranding;
}

/** Stripe Price IDs — optional; mock checkout works without them */
export function stripePriceIdForPlan(plan: "pro" | "expert") {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO || null;
  return process.env.STRIPE_PRICE_EXPERT || null;
}
