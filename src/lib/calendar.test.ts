import { test } from "node:test";
import assert from "node:assert/strict";
import { googleBusy, graphBusy } from "./calendar";
import { generateSlots } from "./slots";
import { hasCalendarScope } from "./social-providers";
import { generateUsername, usernameBase } from "./username";

const TZ = "America/New_York";

test("google: free, cancelled, declined and excluded events don't block", () => {
  const at = (h: number) => `2030-01-07T${String(h).padStart(2, "0")}:00:00-05:00`;
  const busy = googleBusy(
    [
      { id: "a", start: { dateTime: at(10) }, end: { dateTime: at(11) } },
      { id: "free", transparency: "transparent", start: { dateTime: at(12) }, end: { dateTime: at(13) } },
      { id: "gone", status: "cancelled", start: { dateTime: at(14) }, end: { dateTime: at(15) } },
      {
        id: "no",
        attendees: [{ self: true, responseStatus: "declined" }],
        start: { dateTime: at(16) },
        end: { dateTime: at(17) },
      },
      { id: "mine", start: { dateTime: at(18) }, end: { dateTime: at(19) } },
    ],
    TZ,
    "mine"
  );
  assert.equal(busy.length, 1);
  assert.equal(busy[0].start.toISOString(), "2030-01-07T15:00:00.000Z");
});

test("google: all-day events cover the whole day in the host's timezone", () => {
  const [b] = googleBusy(
    [{ id: "d", start: { date: "2030-01-07" }, end: { date: "2030-01-08" } }],
    TZ
  );
  assert.equal(b.start.toISOString(), "2030-01-07T05:00:00.000Z");
  assert.equal(b.end.toISOString(), "2030-01-08T05:00:00.000Z");
});

test("outlook: parses 7-digit UTC times and skips free/declined/cancelled", () => {
  const busy = graphBusy(
    [
      { id: "a", showAs: "busy", start: { dateTime: "2030-01-07T15:00:00.0000000" }, end: { dateTime: "2030-01-07T16:00:00.0000000" } },
      { id: "t", showAs: "tentative", start: { dateTime: "2030-01-07T17:00:00.0000000" }, end: { dateTime: "2030-01-07T18:00:00.0000000" } },
      { id: "f", showAs: "free", start: { dateTime: "2030-01-07T19:00:00.0000000" }, end: { dateTime: "2030-01-07T20:00:00.0000000" } },
      { id: "c", isCancelled: true, showAs: "busy", start: { dateTime: "2030-01-07T21:00:00.0000000" }, end: { dateTime: "2030-01-07T22:00:00.0000000" } },
      { id: "d", showAs: "busy", responseStatus: { response: "declined" }, start: { dateTime: "2030-01-08T15:00:00.0000000" }, end: { dateTime: "2030-01-08T16:00:00.0000000" } },
    ],
    TZ
  );
  assert.deepEqual(
    busy.map((b) => b.start.toISOString()),
    ["2030-01-07T15:00:00.000Z", "2030-01-07T17:00:00.000Z"]
  );
});

test("calendar busy time removes overlapping slots, buffers included", () => {
  const settings = { hostId: "h", bufferBeforeMinutes: 0, bufferAfterMinutes: 15, minNoticeMinutes: 0, changeNoticeHours: 24, calendarProvider: null };
  const base = {
    date: "2030-01-07",
    durationMinutes: 60,
    timeZone: TZ,
    rules: [{ id: "r", hostId: "h", dayOfWeek: 1, startTime: "09:00", endTime: "13:00" }],
    overrides: [],
    settings,
    existingBookings: [],
    now: new Date("2030-01-01T00:00:00Z"),
  };
  const all = generateSlots(base).map((s) => s.startISO);
  assert.equal(all.length, 4);
  // 10:00-11:00 ET is busy: that hour is gone, and 09:00's slot loses out to the 15 min buffer.
  const some = generateSlots({
    ...base,
    externalBusy: [{ start: new Date("2030-01-07T15:00:00Z"), end: new Date("2030-01-07T16:00:00Z") }],
  }).map((s) => s.startISO);
  assert.deepEqual(some, ["2030-01-07T16:00:00.000Z", "2030-01-07T17:00:00.000Z"]);
});

test("calendar scope detection handles Google, Microsoft and separators", () => {
  assert.equal(hasCalendarScope("google", "email,profile,openid,https://www.googleapis.com/auth/calendar.events"), true);
  assert.equal(hasCalendarScope("google", "openid email profile"), false);
  assert.equal(hasCalendarScope("google", null), false);
  assert.equal(hasCalendarScope("microsoft", "openid,profile,User.Read,Calendars.ReadWrite"), true);
  assert.equal(hasCalendarScope("microsoft", "https://graph.microsoft.com/Calendars.ReadWrite User.Read"), true);
  assert.equal(hasCalendarScope("microsoft", "User.Read Calendars.Read"), false);
});

test("usernames come from the email and stay valid and unique", async () => {
  assert.equal(usernameBase("Tom.Smith+work@gmail.com"), "tom_smith_work");
  assert.equal(usernameBase("a@b.com"), "user");
  assert.equal(usernameBase("ünï@b.com"), "user");
  assert.equal(await generateUsername("tom@x.com", "Tom", async () => false), "tom");
  const taken = new Set(["tom"]);
  const next = await generateUsername("tom@x.com", "Tom", async (u) => taken.has(u));
  assert.match(next, /^tom\d{4}$/);
  assert.notEqual(await generateUsername("dashboard@x.com", null, async () => false), "dashboard");
  for (const email of ["x@y.com", "a_very.long.address.that.keeps.going.on.and.on@y.com"]) {
    assert.match(await generateUsername(email, null, async () => false), /^[a-z0-9_]{3,30}$/);
  }
});
