import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { booking, user } from "@/db/schema";
import { getStripe, planFromPriceId, stripeConfigured } from "@/lib/stripe";
import { sendBookingConfirmation } from "@/lib/email";
import { syncBookingToCalendar } from "@/lib/calendar";
import { balanceNote } from "@/lib/money";
import { manageUrl } from "@/lib/manage";
import { formatInTimeZone } from "date-fns-tz";
import { eventType } from "@/db/schema";

export const runtime = "nodejs";

async function confirmBooking(bookingId: string, sessionId?: string, paymentIntentId?: string) {
  const rows = await db.select().from(booking).where(eq(booking.id, bookingId)).limit(1);
  const b = rows[0];
  if (!b) return;
  if (b.status === "cancelled") {
    // Cancelled before the payment landed: don't revive it. The host must refund.
    console.warn(`Payment received for cancelled booking ${bookingId}; refund it manually.`);
    return;
  }

  await db
    .update(booking)
    .set({
      status: "confirmed",
      amountPaidCents: b.dueNowCents + b.tipCents,
      stripeCheckoutSessionId: sessionId ?? b.stripeCheckoutSessionId,
      stripePaymentIntentId: paymentIntentId ?? b.stripePaymentIntentId,
      updatedAt: new Date(),
    })
    .where(eq(booking.id, bookingId));
  await syncBookingToCalendar(bookingId);

  const [host] = await db.select().from(user).where(eq(user.id, b.hostId)).limit(1);
  const [evt] = await db
    .select()
    .from(eventType)
    .where(eq(eventType.id, b.eventTypeId))
    .limit(1);

  if (host && evt) {
    const whenLabel = formatInTimeZone(
      b.startAt,
      host.timezone,
      "EEE, MMM d yyyy 'at' h:mm a zzz"
    );
    await sendBookingConfirmation({
      guestEmail: b.guestEmail,
      guestName: b.guestName,
      hostEmail: host.email,
      hostName: host.name,
      eventTitle: evt.title,
      whenLabel,
      paymentNote: balanceNote(Math.max(0, b.totalCents - b.dueNowCents)),
      manageUrl: b.manageToken ? manageUrl(b.manageToken) : undefined,
    });
  }
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret || !sig) {
    return NextResponse.json(
      {
        error:
          "Stripe webhooks require STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and a signature. Use /api/stripe/mock-complete for local mock flows.",
      },
      { status: 400 }
    );
  }

  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const type = session.metadata?.type;

    if (type === "subscription") {
      const userId = session.metadata?.userId;
      const planMeta = session.metadata?.plan as "pro" | "expert" | undefined;
      let plan: "pro" | "expert" | undefined = planMeta;
      if (!plan && session.subscription && typeof session.subscription === "string") {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = sub.items.data[0]?.price.id;
        const fromPrice = planFromPriceId(priceId);
        if (fromPrice === "pro" || fromPrice === "expert") plan = fromPrice;
      }
      if (userId && plan) {
        await db
          .update(user)
          .set({
            plan,
            stripeCustomerId:
              typeof session.customer === "string"
                ? session.customer
                : undefined,
            updatedAt: new Date(),
          })
          .where(eq(user.id, userId));
      }
    }

    if (type === "booking" && session.metadata?.bookingId) {
      await confirmBooking(
        session.metadata.bookingId,
        session.id,
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : undefined
      );
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const userId = sub.metadata?.userId;
    if (userId) {
      if (event.type === "customer.subscription.deleted" || sub.status === "canceled") {
        await db
          .update(user)
          .set({ plan: "free", updatedAt: new Date() })
          .where(eq(user.id, userId));
      } else {
        const priceId = sub.items.data[0]?.price.id;
        const plan = planFromPriceId(priceId) || (sub.metadata?.plan as PlanSafe);
        if (plan === "pro" || plan === "expert" || plan === "free") {
          await db
            .update(user)
            .set({ plan, updatedAt: new Date() })
            .where(eq(user.id, userId));
        }
      }
    }
  }

  if (event.type === "account.updated") {
    const account = event.data.object;
    const userId = account.metadata?.userId;
    if (userId) {
      const onboarded = Boolean(
        account.charges_enabled && account.details_submitted
      );
      await db
        .update(user)
        .set({
          stripeConnectAccountId: account.id,
          stripeConnectOnboarded: onboarded,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    }
  }

  return NextResponse.json({ received: true, stripeConfigured: stripeConfigured() });
}

type PlanSafe = "free" | "pro" | "expert" | undefined;
