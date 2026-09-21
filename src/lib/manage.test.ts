import { test } from "node:test";
import assert from "node:assert/strict";
import { guestChangeState } from "./manage";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2030-01-10T12:00:00Z");
const startIn = (hours: number) => new Date(NOW.getTime() + hours * HOUR);

const state = (
  over: Partial<Parameters<typeof guestChangeState>[0]> & { hoursAway?: number }
) =>
  guestChangeState({
    status: "confirmed",
    startAt: startIn(over.hoursAway ?? 48),
    changeNoticeHours: 24,
    now: NOW,
    ...over,
  });

test("well before the cutoff is ok", () => {
  assert.equal(state({ hoursAway: 48 }), "ok");
});

test("exactly at the cutoff is still ok, one minute later is too late", () => {
  assert.equal(state({ hoursAway: 24 }), "ok");
  assert.equal(
    guestChangeState({
      status: "confirmed",
      startAt: new Date(NOW.getTime() + 24 * HOUR - 60 * 1000),
      changeNoticeHours: 24,
      now: NOW,
    }),
    "too_late"
  );
});

test("inside the window is too late", () => {
  assert.equal(state({ hoursAway: 3 }), "too_late");
});

test("0 hours means changes are allowed until the start time", () => {
  assert.equal(state({ hoursAway: 0.1, changeNoticeHours: 0 }), "ok");
  assert.equal(state({ hoursAway: 0, changeNoticeHours: 0 }), "past");
});

test("appointments in the past can't be changed", () => {
  assert.equal(state({ hoursAway: -2 }), "past");
  assert.equal(state({ status: "completed", hoursAway: 48 }), "past");
});

test("cancelled bookings report cancelled, even if in the past", () => {
  assert.equal(state({ status: "cancelled" }), "cancelled");
  assert.equal(state({ status: "cancelled", hoursAway: -5 }), "cancelled");
});

test("a booking waiting for payment can only be cancelled, and the cutoff doesn't apply", () => {
  assert.equal(state({ status: "pending_payment", hoursAway: 48 }), "pending_payment");
  assert.equal(state({ status: "pending_payment", hoursAway: 2 }), "pending_payment");
});
