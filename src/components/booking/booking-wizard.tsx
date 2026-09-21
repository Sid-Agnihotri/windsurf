"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { PricingMode } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { createGuestBooking, getSlotsForPublic } from "@/actions/host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BookingWizard({
  username,
  eventSlug,
  hostTimeZone,
  tipsEnabled,
  pricingMode,
  priceCents,
  depositCents,
  acceptCash,
  cardAvailable,
  accent,
}: {
  username: string;
  eventSlug: string;
  hostTimeZone: string;
  tipsEnabled: boolean;
  pricingMode: PricingMode;
  priceCents: number;
  depositCents: number;
  /** Guest may choose to pay in person */
  acceptCash: boolean;
  /** Host has finished Stripe Connect, so card payments work */
  cardAvailable: boolean;
  accent: string;
}) {
  const guestTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const dates = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)),
    []
  );

  const [date, setDate] = useState(
    formatInTimeZone(new Date(), hostTimeZone, "yyyy-MM-dd")
  );
  const [slots, setSlots] = useState<{ startISO: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullyBooked, setFullyBooked] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{
    bookingId: string;
    balanceDueCents: number;
    manageUrl: string | null;
  } | null>(null);

  const isPriced = pricingMode !== "free";
  const [method, setMethod] = useState<"card" | "cash">(
    cardAvailable || !acceptCash ? "card" : "cash"
  );
  const canPay = !isPriced || cardAvailable || acceptCash;
  const totalCents =
    pricingMode === "deposit" ? Math.max(priceCents, depositCents) : priceCents;
  const dueNowCents = pricingMode === "deposit" ? depositCents : priceCents;

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setSelected(null);
    getSlotsForPublic({ username, eventSlug, date }).then((res) => {
      if (cancelled) return;
      setLoadingSlots(false);
      if (res.error && "fullyBooked" in res && res.fullyBooked) {
        setFullyBooked(true);
        setError(res.error);
        setSlots([]);
        return;
      }
      setFullyBooked(false);
      setError(res.error && !res.slots.length ? res.error : null);
      setSlots(res.slots || []);
    });
    return () => {
      cancelled = true;
    };
  }, [username, eventSlug, date]);

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re booked</CardTitle>
          <CardDescription>
            Confirmation emails were sent (or logged in mock mode). Booking ID:{" "}
            {done.bookingId}
            {done.balanceDueCents > 0
              ? ` · ${formatMoney(done.balanceDueCents)} is due in person at your appointment.`
              : ""}
          </CardDescription>
        </CardHeader>
        {done.manageUrl && (
          <CardContent>
            <a
              href={done.manageUrl}
              className="text-sm text-teal-800 underline"
            >
              Need to change or cancel? Manage your booking
            </a>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Pick a day</CardTitle>
          <CardDescription>
            Host timezone: {hostTimeZone}. You: {guestTz}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {dates.map((d) => {
            const key = formatInTimeZone(d, hostTimeZone, "yyyy-MM-dd");
            const active = key === date;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDate(key)}
                className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                  active
                    ? "border-transparent text-white"
                    : "border-slate-200 hover:border-slate-400"
                }`}
                style={active ? { background: accent } : undefined}
              >
                <div className="font-medium">{format(d, "EEE")}</div>
                <div className="text-xs opacity-80">{format(d, "MMM d")}</div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time & details</CardTitle>
          <CardDescription>
            {loadingSlots
              ? "Loading slots…"
              : fullyBooked
                ? "Host is at their monthly booking limit."
                : slots.length
                  ? `${slots.length} open slot(s)`
                  : "No open slots this day."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {slots.map((s) => {
              const label = new Date(s.startISO).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              });
              const active = selected === s.startISO;
              return (
                <button
                  key={s.startISO}
                  type="button"
                  onClick={() => setSelected(s.startISO)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    active ? "text-white" : "hover:border-slate-400"
                  }`}
                  style={active ? { background: accent } : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {selected && (
            <form
              className="space-y-3 border-t pt-4"
              action={(fd) => {
                start(async () => {
                  const tipDollars = Number(fd.get("tip") || 0);
                  const res = await createGuestBooking({
                    username,
                    eventSlug,
                    startISO: selected,
                    guestName: String(fd.get("guestName") || ""),
                    guestEmail: String(fd.get("guestEmail") || ""),
                    guestNote: String(fd.get("guestNote") || ""),
                    tipCents: method === "card" ? Math.round(tipDollars * 100) : 0,
                    paymentMethod: isPriced ? method : undefined,
                  });
                  if (res.error) {
                    setError(res.error);
                    return;
                  }
                  if (res.checkoutUrl) {
                    window.location.href = res.checkoutUrl;
                    return;
                  }
                  setDone({
                    bookingId: res.bookingId!,
                    balanceDueCents: res.balanceDueCents ?? 0,
                    manageUrl: res.manageUrl ?? null,
                  });
                });
              }}
            >
              <div className="space-y-1">
                <Label>Your name</Label>
                <Input name="guestName" required />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input name="guestEmail" type="email" required />
              </div>
              <div className="space-y-1">
                <Label>Note (optional)</Label>
                <Textarea name="guestNote" />
              </div>
              {isPriced && acceptCash && cardAvailable && (
                <div className="space-y-1">
                  <Label>How would you like to pay?</Label>
                  <div className="flex flex-col gap-1 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={method === "card"}
                        onChange={() => setMethod("card")}
                      />
                      Pay online by card
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={method === "cash"}
                        onChange={() => setMethod("cash")}
                      />
                      Pay in person (cash)
                    </label>
                  </div>
                </div>
              )}
              {tipsEnabled && method === "card" && (
                <div className="space-y-1">
                  <Label>Tip (CAD, optional)</Label>
                  <Input name="tip" type="number" min={0} step="1" defaultValue={0} />
                </div>
              )}
              {!canPay && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  This host isn&apos;t set up to take payments yet. Please
                  contact them directly.
                </p>
              )}
              {isPriced && canPay && (
                <p className="text-sm text-muted-foreground">
                  {method === "cash" ? (
                    <>
                      Nothing to pay now.{" "}
                      <strong>{formatMoney(totalCents)}</strong> is due in
                      person at your appointment.
                    </>
                  ) : (
                    <>
                      You&apos;ll pay <strong>{formatMoney(dueNowCents)}</strong>
                      {pricingMode === "deposit" ? " deposit" : ""} at checkout
                      {tipsEnabled ? " plus any tip" : ""}.
                      {totalCents > dueNowCents && (
                        <>
                          {" "}
                          The remaining {formatMoney(totalCents - dueNowCents)}{" "}
                          is due in person.
                        </>
                      )}
                    </>
                  )}
                </p>
              )}
              <Button
                type="submit"
                disabled={pending || !canPay}
                className="w-full"
                style={{ background: accent }}
              >
                {pending
                  ? "Booking…"
                  : !isPriced || method === "cash"
                    ? "Confirm booking"
                    : "Continue to payment"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
