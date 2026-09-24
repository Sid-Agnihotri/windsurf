import { formatInTimeZone } from "date-fns-tz";

export type TimezoneOption = { id: string; label: string };
export type TimezoneGroup = { label: string; options: TimezoneOption[] };

/** Every province and territory's main zones, east to west. */
const CANADA: [string, string][] = [
  ["America/St_Johns", "Newfoundland – St. John's"],
  ["America/Halifax", "Atlantic – Halifax"],
  ["America/Toronto", "Eastern – Toronto"],
  ["America/Winnipeg", "Central – Winnipeg"],
  ["America/Regina", "Central, no daylight saving – Regina"],
  ["America/Edmonton", "Mountain – Edmonton"],
  ["America/Vancouver", "Pacific – Vancouver"],
  ["America/Whitehorse", "Yukon – Whitehorse"],
];

const UNITED_STATES: [string, string][] = [
  ["America/New_York", "Eastern – New York"],
  ["America/Chicago", "Central – Chicago"],
  ["America/Denver", "Mountain – Denver"],
  ["America/Phoenix", "Mountain, no daylight saving – Phoenix"],
  ["America/Los_Angeles", "Pacific – Los Angeles"],
  ["America/Anchorage", "Alaska – Anchorage"],
  ["Pacific/Honolulu", "Hawaii – Honolulu"],
];

/** The canonical IANA name for `tz`, or null if it isn't a real timezone. */
export function validTimeZone(tz: string | null | undefined) {
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** Names the runtime still reports for zones that have since been renamed. */
const MODERN_NAME: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "Atlantic/Faeroe": "Atlantic/Faroe",
};

function withOffset(id: string, name: string, now: Date): TimezoneOption {
  return { id, label: `(UTC${formatInTimeZone(now, id, "xxx")}) ${name}` };
}

/**
 * Timezone choices for a dropdown: Canada and the US first, then everything else by
 * region. Built on the server, since the browser's zone list can differ from Node's and
 * would break hydration. `current` is always included, even if it's an old alias.
 */
export function getTimezoneGroups(current?: string, now = new Date()): TimezoneGroup[] {
  const featured = new Set([...CANADA, ...UNITED_STATES].map(([id]) => id));
  const groups: TimezoneGroup[] = [
    { label: "Canada", options: CANADA.map(([id, n]) => withOffset(id, n, now)) },
    { label: "United States", options: UNITED_STATES.map(([id, n]) => withOffset(id, n, now)) },
  ];

  const byRegion = new Map<string, TimezoneOption[]>();
  const all = [
    ...new Set(
      [...Intl.supportedValuesOf("timeZone"), "UTC"].map((id) => {
        const modern = MODERN_NAME[id];
        return modern && validTimeZone(modern) ? modern : id;
      })
    ),
  ];
  for (const id of all) {
    if (featured.has(id)) continue;
    const region = id.includes("/") ? id.split("/")[0] : "Other";
    const name = id.split("/").slice(1).join(" / ").replace(/_/g, " ") || id;
    byRegion.set(region, [...(byRegion.get(region) ?? []), withOffset(id, name, now)]);
  }
  for (const region of [...byRegion.keys()].sort()) {
    groups.push({
      label: region === "America" ? "Americas (other)" : region,
      options: byRegion.get(region)!,
    });
  }

  if (current && !groups.some((g) => g.options.some((o) => o.id === current))) {
    groups.unshift({ label: "Current", options: [{ id: current, label: current }] });
  }
  return groups;
}
