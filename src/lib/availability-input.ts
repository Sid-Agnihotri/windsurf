/**
 * Pure helpers behind the availability editor: validating what the browser sends,
 * expanding a date range into days, grouping overrides for display, and turning
 * numbers and times into plain language. No database or React in here, so it's all tested.
 */

export type Window = { startTime: string; endTime: string };
/** One weekday (0 = Sunday) and its open windows; no windows = closed that day. */
export type DaySchedule = { day: number; windows: Window[] };

export const MAX_WINDOWS_PER_DAY = 4;
export const MAX_TIME_OFF_DAYS = 366;

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const isHm = (s: unknown): s is string => typeof s === "string" && HM.test(s);

/** Real calendar date in YYYY-MM-DD form (rejects 2030-02-31). */
export function isYmd(s: unknown): s is string {
  if (typeof s !== "string" || !YMD.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Checks a list of windows: valid times, start before end, sorted, none overlapping. */
export function validateWindows(windows: unknown): { error: string } | { windows: Window[] } {
  if (!Array.isArray(windows)) return { error: "Hours are missing." };
  if (windows.length > MAX_WINDOWS_PER_DAY) {
    return { error: `Use at most ${MAX_WINDOWS_PER_DAY} time ranges per day.` };
  }
  const clean: Window[] = [];
  for (const w of windows) {
    if (!isHm(w?.startTime) || !isHm(w?.endTime)) return { error: "Enter valid times." };
    if (w.startTime >= w.endTime) return { error: "Each range must end after it starts." };
    clean.push({ startTime: w.startTime, endTime: w.endTime });
  }
  clean.sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < clean.length; i++) {
    if (clean[i].startTime < clean[i - 1].endTime) {
      return { error: "Time ranges on the same day can't overlap." };
    }
  }
  return { windows: clean };
}

/** Validates the whole week as sent from the editor. */
export function validateWeeklySchedule(
  input: unknown
): { error: string } | { days: DaySchedule[] } {
  if (!Array.isArray(input) || input.length > 7) return { error: "Invalid schedule." };
  const seen = new Set<number>();
  const days: DaySchedule[] = [];
  for (const entry of input) {
    const day = entry?.day;
    if (!Number.isInteger(day) || day < 0 || day > 6 || seen.has(day)) {
      return { error: "Invalid schedule." };
    }
    seen.add(day);
    const result = validateWindows(entry.windows);
    if ("error" in result) return result;
    days.push({ day, windows: result.windows });
  }
  return { days };
}

/** Every date from `start` to `end` inclusive, as YYYY-MM-DD. `today` (host's local date) is the earliest allowed. */
export function expandDateRange(
  start: unknown,
  end: unknown,
  today: string
): { error: string } | { dates: string[] } {
  if (!isYmd(start) || !isYmd(end)) return { error: "Choose valid dates." };
  if (end < start) return { error: "The end date can't be before the start date." };
  if (start < today) return { error: "Time off has to start today or later." };
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    if (dates.length >= MAX_TIME_OFF_DAYS) {
      return { error: `Time off can cover at most ${MAX_TIME_OFF_DAYS} days at once.` };
    }
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { dates };
}

// ——— Date overrides, grouped for display ———

export type OverrideRow = {
  id: string;
  date: string;
  unavailable: boolean;
  windowsJson: string | null;
};

/** A run of consecutive days with identical hours, shown as one line ("Dec 24 – 26"). */
export type TimeOffGroup = {
  ids: string[];
  startDate: string;
  endDate: string;
  unavailable: boolean;
  windows: Window[];
};

function parseWindows(json: string | null): Window[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((w): w is Window => isHm(w?.startTime) && isHm(w?.endTime));
  } catch {
    return [];
  }
}

function nextDay(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Upcoming overrides (from `today`), oldest first, with runs of matching consecutive days merged. */
export function groupOverrides(rows: OverrideRow[], today: string): TimeOffGroup[] {
  const groups: TimeOffGroup[] = [];
  const upcoming = rows.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  for (const row of upcoming) {
    const windows = row.unavailable ? [] : parseWindows(row.windowsJson);
    const prev = groups.at(-1);
    if (
      prev &&
      nextDay(prev.endDate) === row.date &&
      prev.unavailable === row.unavailable &&
      JSON.stringify(prev.windows) === JSON.stringify(windows)
    ) {
      prev.endDate = row.date;
      prev.ids.push(row.id);
    } else {
      groups.push({
        ids: [row.id],
        startDate: row.date,
        endDate: row.date,
        unavailable: row.unavailable,
        windows,
      });
    }
  }
  return groups;
}

// ——— Plain-language formatting ———

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Wed, Dec 24" for a YYYY-MM-DD date (no timezone maths: it's a calendar date). */
export function formatDateLabel(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${WEEKDAY[d.getUTCDay()]}, ${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatDateRange(startDate: string, endDate: string) {
  return startDate === endDate
    ? formatDateLabel(startDate)
    : `${formatDateLabel(startDate)} – ${formatDateLabel(endDate)}`;
}

/** "14:30" -> "2:30 PM". */
export function formatTime(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** 0 -> "None", 90 -> "90 minutes", 120 -> "2 hours", 1440 -> "1 day", 10080 -> "1 week". */
export function formatMinutes(min: number) {
  if (min === 0) return "None";
  if (min % 10080 === 0) return plural(min / 10080, "week");
  if (min % 1440 === 0) return plural(min / 1440, "day");
  if (min % 60 === 0) return plural(min / 60, "hour");
  return plural(min, "minute");
}

/** The preset choices plus the saved value if it isn't one of them, so nothing is silently changed. */
export function withCurrent(presets: number[], current: number) {
  return [...new Set([...presets, current])].sort((a, b) => a - b);
}

export const BUFFER_PRESETS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];
export const NOTICE_PRESETS = [0, 30, 60, 120, 240, 480, 720, 1440, 2880, 4320, 10080];
/** Hours before the appointment that guests can still cancel or reschedule; 0 = until it starts. */
export const CHANGE_PRESETS = [0, 1, 2, 4, 12, 24, 48, 72, 168];

export function formatChangeCutoff(hours: number) {
  if (hours === 0) return "Any time before it starts";
  if (hours % 24 === 0) return `${plural(hours / 24, "day")} before`;
  return `${plural(hours, "hour")} before`;
}
