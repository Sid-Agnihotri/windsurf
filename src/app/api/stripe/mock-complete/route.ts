import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { booking, eventType, user } from "@/db/schema";
import { sendBookingConfirmation } from "@/lib/email";
import { syncBookingToCalendar } from "@/lib/calendar";
import { balanceNote } from "@/lib/money";
import { manageUrl } from "@/lib/manage";
import { formatInTimeZone } from "date-fns-tz";
import { appUrl, stripeConfigured } from "@/lib/stripe";
import { getSession } from "@/lib/auth";

/**
 * Local/mock fallback when Stripe keys are missing.
 * Completes subscription upgrades, Connect onboarding, or booking payment.
 * Disabled entirely once Stripe is configured.
 */
export async function GET(req: NextRequest) {
  if (stripeConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");

  // Plan and Connect changes act on a host account, so only that host may trigger them.
  if (type === "subscription" || type === "connect") {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.id !== sp.get("userId")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (type === "subscription") {
    const userId = sp.get("userId");
    const plan = sp.get("plan");
    if (!userId || (plan !== "pro" && plan !== "expert")) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }
    await db
      .update(user)
      .set({
        plan,
        stripeCustomerId: `cus_mock_${userId}`,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
    return NextResponse.redirect(`${appUrl()}/dashboard/billing?success=1&mock=1`);
  }

  if (type === "connect") {
    const userId = sp.get("userId");
    const accountId = sp.get("accountId") || `acct_mock_${userId}`;
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    await db
      .update(user)
      .set({
        stripeConnectAccountId: accountId,
        stripeConnectOnboarded: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
    return NextResponse.redirect(`${appUrl()}/dashboard/settings/payments?connect=return&mock=1`);
  }

  if (type === "booking") {
    const bookingId = sp.get("bookingId");
    const sessionId = sp.get("sessionId");
    if (!bookingId) {
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
    }
    const [b] = await db.select().from(booking).where(eq(booking.id, bookingId)).limit(1);
    if (!b) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (b.status !== "pending_payment") {
      return NextResponse.redirect(
        `${appUrl()}/booking/success?bookingId=${bookingId}&mock=1`
      );
    }
    await db
      .update(booking)
      .set({
        status: "confirmed",
        amountPaidCents: b.dueNowCents + b.tipCents,
        stripeCheckoutSessionId: sessionId,
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
    return NextResponse.redirect(
      `${appUrl()}/booking/success?bookingId=${bookingId}&mock=1`
    );
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
