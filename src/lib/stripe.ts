import Stripe from "stripe";
import type { Plan } from "@/db/schema";
import { CURRENCY } from "@/lib/money";

let _stripe: Stripe | null = null;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) {
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://127.0.0.1:43123"
  );
}

export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_EXPERT) return "expert";
  return null;
}

export type MockCheckout = {
  mocked: true;
  url: string;
  sessionId: string;
};

/**
 * Create subscription Checkout for Pro/Expert.
 * Without Stripe keys, returns a mock URL that simulates success via /api/stripe/mock-complete.
 */
export async function createSubscriptionCheckout(opts: {
  customerId: string | null;
  customerEmail: string;
  userId: string;
  plan: "pro" | "expert";
  priceId: string | null;
}): Promise<{ url: string; sessionId: string; mocked: boolean }> {
  const stripe = getStripe();
  if (!stripe || !opts.priceId) {
    const sessionId = `mock_sub_${opts.plan}_${opts.userId}_${Date.now()}`;
    const url = `${appUrl()}/api/stripe/mock-complete?type=subscription&plan=${opts.plan}&userId=${opts.userId}&sessionId=${sessionId}`;
    return { url, sessionId, mocked: true };
  }

  let customer = opts.customerId;
  if (!customer) {
    const c = await stripe.customers.create({
      email: opts.customerEmail,
      metadata: { userId: opts.userId },
    });
    customer = c.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    success_url: `${appUrl()}/dashboard/billing?success=1`,
    cancel_url: `${appUrl()}/dashboard/billing?canceled=1`,
    metadata: { userId: opts.userId, plan: opts.plan, type: "subscription" },
    subscription_data: {
      metadata: { userId: opts.userId, plan: opts.plan },
    },
  });

  return {
    url: session.url!,
    sessionId: session.id,
    mocked: false,
  };
}

export async function createConnectOnboardingLink(opts: {
  accountId: string | null;
  userId: string;
  email: string;
}): Promise<{ url: string; accountId: string; mocked: boolean }> {
  const stripe = getStripe();
  if (!stripe) {
    const accountId = opts.accountId || `acct_mock_${opts.userId}`;
    const url = `${appUrl()}/api/stripe/mock-complete?type=connect&userId=${opts.userId}&accountId=${accountId}`;
    return { url, accountId, mocked: true };
  }

  let accountId = opts.accountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: opts.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { userId: opts.userId },
    });
    accountId = account.id;
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl()}/dashboard/settings/payments?connect=refresh`,
    return_url: `${appUrl()}/dashboard/settings/payments?connect=return`,
    type: "account_onboarding",
  });

  return { url: link.url, accountId, mocked: false };
}

export async function createBookingCheckout(opts: {
  bookingId: string;
  hostConnectAccountId: string;
  amountCents: number;
  tipCents: number;
  eventTitle: string;
  guestEmail: string;
  isDeposit: boolean;
}): Promise<{ url: string; sessionId: string; mocked: boolean }> {
  const stripe = getStripe();
  const total = opts.amountCents + opts.tipCents;

  if (!stripe || opts.hostConnectAccountId.startsWith("acct_mock_")) {
    const sessionId = `mock_book_${opts.bookingId}`;
    const url = `${appUrl()}/api/stripe/mock-complete?type=booking&bookingId=${opts.bookingId}&sessionId=${sessionId}`;
    return { url, sessionId, mocked: true };
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: opts.amountCents,
        product_data: {
          name: opts.isDeposit
            ? `Deposit: ${opts.eventTitle}`
            : opts.eventTitle,
        },
      },
    },
  ];
  if (opts.tipCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: opts.tipCents,
        product_data: { name: "Tip" },
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: opts.guestEmail,
    line_items: lineItems,
    success_url: `${appUrl()}/booking/success?bookingId=${opts.bookingId}`,
    cancel_url: `${appUrl()}/booking/cancel?bookingId=${opts.bookingId}`,
    metadata: {
      type: "booking",
      bookingId: opts.bookingId,
      tipCents: String(opts.tipCents),
      isDeposit: opts.isDeposit ? "1" : "0",
    },
    payment_intent_data: {
      transfer_data: {
        destination: opts.hostConnectAccountId,
      },
      // 0% platform fee in v1
    },
  });

  return { url: session.url!, sessionId: session.id, mocked: false };
}
