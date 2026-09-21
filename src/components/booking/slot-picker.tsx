"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

type SlotResult = { error?: string; slots: { startISO: string }[] };

/**
 * A 14-day date strip plus that day's open times. Days are keyed in the host's
 * timezone; times are shown in the guest's own timezone.
 */
export function SlotPicker({
  hostTimeZone,
  loadSlots,
  selected,
  onSelect,
}: {
  hostTimeZone: string;
  loadSlots: (date: string) => Promise<SlotResult>;
  selected: string | null;
  onSelect: (startISO: string) => void;
}) {
  const dates = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)),
    []
  );
  const [date, setDate] = useState(
    formatInTimeZone(new Date(), hostTimeZone, "yyyy-MM-dd")
  );
  const [result, setResult] = useState<(SlotResult & { date: string }) | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    loadSlots(date).then((r) => {
      if (!cancelled) setResult({ ...r, date });
    });
    return () => {
      cancelled = true;
    };
    // `loadSlots` is recreated by callers each render; only the date should refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const loading = result?.date !== date;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
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
                  ? "border-transparent bg-teal-800 text-white"
                  : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <div className="font-medium">{format(d, "EEE")}</div>
              <div className="text-xs opacity-80">{format(d, "MMM d")}</div>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        {loading
          ? "Loading times…"
          : result?.error
            ? result.error
            : result && result.slots.length
              ? `${result.slots.length} open time(s), shown in your timezone`
              : "No open times this day."}
      </p>

      {!loading && (
        <div className="flex flex-wrap gap-2">
          {result?.slots.map((s) => {
            const active = selected === s.startISO;
            return (
              <button
                key={s.startISO}
                type="button"
                onClick={() => onSelect(s.startISO)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  active
                    ? "border-transparent bg-teal-800 text-white"
                    : "hover:border-slate-400"
                }`}
              >
                {new Date(s.startISO).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
