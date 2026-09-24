import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expandDateRange,
  formatChangeCutoff,
  formatDateRange,
  formatMinutes,
  formatTime,
  groupOverrides,
  isYmd,
  validateWeeklySchedule,
  validateWindows,
  withCurrent,
} from "./availability-input";

const w = (startTime: string, endTime: string) => ({ startTime, endTime });

test("windows: sorted, split shifts allowed, overlaps and bad times rejected", () => {
  assert.deepEqual(validateWindows([w("13:00", "17:00"), w("09:00", "12:00")]), {
    windows: [w("09:00", "12:00"), w("13:00", "17:00")],
  });
  assert.ok("windows" in validateWindows([w("09:00", "12:00"), w("12:00", "15:00")]), "touching is fine");
  assert.ok("error" in validateWindows([w("09:00", "13:00"), w("12:00", "15:00")]));
  assert.ok("error" in validateWindows([w("17:00", "09:00")]));
  assert.ok("error" in validateWindows([w("09:00", "09:00")]));
  assert.ok("error" in validateWindows([w("9:00", "17:00")]));
  assert.ok("error" in validateWindows([w("09:00", "24:00")]));
  assert.ok("error" in validateWindows([w("09:00", "10:00"), w("10:00", "11:00"), w("11:00", "12:00"), w("12:00", "13:00"), w("13:00", "14:00")]));
  assert.ok("error" in validateWindows("nope"));
});

test("weekly schedule: closed days are fine, duplicate or out-of-range days are not", () => {
  assert.deepEqual(validateWeeklySchedule([{ day: 1, windows: [w("09:00", "17:00")] }, { day: 2, windows: [] }]), {
    days: [{ day: 1, windows: [w("09:00", "17:00")] }, { day: 2, windows: [] }],
  });
  assert.deepEqual(validateWeeklySchedule([]), { days: [] });
  assert.ok("error" in validateWeeklySchedule([{ day: 1, windows: [] }, { day: 1, windows: [] }]));
  assert.ok("error" in validateWeeklySchedule([{ day: 7, windows: [] }]));
  assert.ok("error" in validateWeeklySchedule([{ day: 1.5, windows: [] }]));
  assert.ok("error" in validateWeeklySchedule("x"));
  assert.ok("error" in validateWeeklySchedule([{ day: 1, windows: [w("17:00", "09:00")] }]));
});

test("real calendar dates only", () => {
  assert.ok(isYmd("2030-02-28"));
  assert.ok(!isYmd("2030-02-31"));
  assert.ok(!isYmd("2030-2-1"));
  assert.ok(!isYmd(20300101));
});

test("date range expands inclusively across month and year ends", () => {
  assert.deepEqual(expandDateRange("2030-12-30", "2031-01-02", "2030-01-01"), {
    dates: ["2030-12-30", "2030-12-31", "2031-01-01", "2031-01-02"],
  });
  assert.deepEqual(expandDateRange("2030-03-05", "2030-03-05", "2030-03-05"), { dates: ["2030-03-05"] });
  assert.deepEqual(expandDateRange("2028-02-28", "2028-03-01", "2028-01-01"), {
    dates: ["2028-02-28", "2028-02-29", "2028-03-01"],
  }, "leap day");
});

test("date range rejects backwards, past, invalid and oversized ranges", () => {
  assert.ok("error" in expandDateRange("2030-03-06", "2030-03-05", "2030-01-01"));
  assert.ok("error" in expandDateRange("2030-03-04", "2030-03-08", "2030-03-05"));
  assert.ok("error" in expandDateRange("2030-13-01", "2030-13-02", "2030-01-01"));
  assert.ok("error" in expandDateRange("2030-01-01", "2032-01-01", "2030-01-01"));
  assert.ok("dates" in expandDateRange("2030-01-01", "2030-12-31", "2030-01-01"));
});

test("overrides: past hidden, consecutive identical days merged, different ones kept apart", () => {
  const row = (id: string, date: string, unavailable: boolean, windows?: object[]) => ({
    id, date, unavailable, windowsJson: windows ? JSON.stringify(windows) : null,
  });
  const groups = groupOverrides(
    [
      row("old", "2030-01-01", true),
      row("c", "2030-06-12", true),
      row("a", "2030-06-10", true),
      row("b", "2030-06-11", true),
      row("d", "2030-06-13", false, [w("10:00", "14:00")]),
      row("e", "2030-06-14", false, [w("10:00", "14:00")]),
      row("f", "2030-06-15", false, [w("11:00", "14:00")]),
      row("g", "2030-06-20", true),
      row("bad", "2030-06-25", false, undefined),
    ],
    "2030-06-01"
  );
  assert.deepEqual(groups.map((g) => [g.startDate, g.endDate, g.ids.join("")]), [
    ["2030-06-10", "2030-06-12", "abc"],
    ["2030-06-13", "2030-06-14", "de"],
    ["2030-06-15", "2030-06-15", "f"],
    ["2030-06-20", "2030-06-20", "g"],
    ["2030-06-25", "2030-06-25", "bad"],
  ]);
  assert.deepEqual(groups[1].windows, [w("10:00", "14:00")]);
});

test("plain-language formatting", () => {
  assert.equal(formatDateRange("2030-12-24", "2030-12-24"), "Tue, Dec 24");
  assert.equal(formatDateRange("2030-12-24", "2030-12-26"), "Tue, Dec 24 – Thu, Dec 26");
  assert.equal(formatTime("00:00"), "12:00 AM");
  assert.equal(formatTime("12:05"), "12:05 PM");
  assert.equal(formatTime("17:30"), "5:30 PM");
  assert.equal(formatMinutes(0), "None");
  assert.equal(formatMinutes(45), "45 minutes");
  assert.equal(formatMinutes(60), "1 hour");
  assert.equal(formatMinutes(120), "2 hours");
  assert.equal(formatMinutes(90), "90 minutes");
  assert.equal(formatMinutes(1440), "1 day");
  assert.equal(formatMinutes(4320), "3 days");
  assert.equal(formatMinutes(10080), "1 week");
  assert.equal(formatChangeCutoff(0), "Any time before it starts");
  assert.equal(formatChangeCutoff(1), "1 hour before");
  assert.equal(formatChangeCutoff(24), "1 day before");
  assert.equal(formatChangeCutoff(36), "36 hours before");
  assert.deepEqual(withCurrent([0, 15, 30], 20), [0, 15, 20, 30]);
  assert.deepEqual(withCurrent([0, 15, 30], 15), [0, 15, 30]);
});
