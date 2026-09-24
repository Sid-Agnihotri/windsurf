import { test } from "node:test";
import assert from "node:assert/strict";
import type { AvailabilityOverride, AvailabilityRule, HostSettings } from "@/db/schema";
import { generateSlots } from "./slots";

const TZ = "America/New_York";
// Monday, far enough ahead that min-notice never applies.
const DATE = "2030-01-07";
const NOW = new Date("2030-01-01T00:00:00Z");

const settings: HostSettings = {
  hostId: "h",
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minNoticeMinutes: 0,
  changeNoticeHours: 24,
  calendarProvider: null,
};

const rule = (startTime: string, endTime: string): AvailabilityRule => ({
  id: "r",
  hostId: "h",
  dayOfWeek: 1,
  startTime,
  endTime,
});

const run = (
  durationMinutes: number,
  rules: AvailabilityRule[],
  overrides: AvailabilityOverride[] = []
) =>
  generateSlots({
    date: DATE,
    durationMinutes,
    timeZone: TZ,
    rules,
    overrides,
    settings,
    existingBookings: [],
    now: NOW,
  });

test("normal window yields back-to-back slots", () => {
  const slots = run(30, [rule("09:00", "11:00")]);
  assert.equal(slots.length, 4);
});

test("zero, negative and NaN durations return no slots instead of hanging", () => {
  for (const d of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(run(d, [rule("09:00", "17:00")]), []);
  }
});

test("malformed or inverted windows are skipped instead of hanging", () => {
  assert.deepEqual(run(30, [rule("ab:cd", "17:00")]), []);
  assert.deepEqual(run(30, [rule("09:00", "zz")]), []);
  assert.deepEqual(run(30, [rule("17:00", "09:00")]), []);
});

test("override with malformed windowsJson entries is ignored", () => {
  const override: AvailabilityOverride = {
    id: "o",
    hostId: "h",
    date: DATE,
    unavailable: false,
    windowsJson: JSON.stringify([{ startTime: 9, endTime: null }, "junk"]),
  };
  assert.deepEqual(run(30, [rule("09:00", "17:00")], [override]), []);
});
