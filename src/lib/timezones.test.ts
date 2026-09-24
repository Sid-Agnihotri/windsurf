import { test } from "node:test";
import assert from "node:assert/strict";
import { getTimezoneGroups, validTimeZone } from "./timezones";

const NOW = new Date("2030-01-15T12:00:00Z");
const ids = (label: string, current?: string) =>
  getTimezoneGroups(current, NOW).find((g) => g.label === label)?.options.map((o) => o.id);

test("Canada is listed first with every main zone, east to west", () => {
  const groups = getTimezoneGroups(undefined, NOW);
  assert.equal(groups[0].label, "Canada");
  assert.deepEqual(ids("Canada"), [
    "America/St_Johns",
    "America/Halifax",
    "America/Toronto",
    "America/Winnipeg",
    "America/Regina",
    "America/Edmonton",
    "America/Vancouver",
    "America/Whitehorse",
  ]);
});

test("labels show the UTC offset, including half-hour zones", () => {
  const find = (id: string) =>
    getTimezoneGroups(undefined, NOW).flatMap((g) => g.options).find((o) => o.id === id);
  assert.match(find("America/Toronto")!.label, /^\(UTC-05:00\) /);
  assert.match(find("America/Vancouver")!.label, /^\(UTC-08:00\) /);
  assert.match(find("America/St_Johns")!.label, /^\(UTC-03:30\) /);
});

test("every zone is offered exactly once, and everything offered is real", () => {
  const all = getTimezoneGroups(undefined, NOW).flatMap((g) => g.options.map((o) => o.id));
  assert.equal(new Set(all).size, all.length);
  assert.ok(all.includes("UTC") && all.includes("Europe/London") && all.includes("Asia/Kolkata"));
  assert.ok(all.every((id) => validTimeZone(id)));
  // Canadian zones outside the main eight are still reachable.
  assert.ok(all.includes("America/Moncton") && all.includes("America/Iqaluit"));
});

test("an unknown or legacy current zone is kept so saving doesn't silently change it", () => {
  const groups = getTimezoneGroups("US/Eastern", NOW);
  assert.equal(groups[0].label, "Current");
  assert.equal(groups[0].options[0].id, "US/Eastern");
  assert.equal(getTimezoneGroups("America/Toronto", NOW)[0].label, "Canada");
});

test("validTimeZone accepts real zones, canonicalises case, rejects junk", () => {
  assert.equal(validTimeZone("America/Vancouver"), "America/Vancouver");
  assert.equal(validTimeZone("america/toronto"), "America/Toronto");
  assert.equal(validTimeZone("UTC"), "UTC");
  assert.equal(validTimeZone("Mars/Olympus"), null);
  assert.equal(validTimeZone(""), null);
  assert.equal(validTimeZone(null), null);
});
