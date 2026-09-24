"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { AvailabilityRule } from "@/db/schema";
import { saveWeeklyHours } from "@/actions/host";
import { validateWindows, MAX_WINDOWS_PER_DAY, type Window } from "@/lib/availability-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Day = { enabled: boolean; windows: Window[] };
type Week = Record<number, Day>;

/** Monday first, the way people think about a working week. Values are JS weekdays (Sunday = 0). */
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS = [1, 2, 3, 4, 5];
const DEFAULT_WINDOW: Window = { startTime: "09:00", endTime: "17:00" };

function toWeek(rules: AvailabilityRule[]): Week {
  const week: Week = {};
  for (let d = 0; d < 7; d++) {
    const windows = rules
      .filter((r) => r.dayOfWeek === d)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    week[d] = { enabled: windows.length > 0, windows: windows.length ? windows : [DEFAULT_WINDOW] };
  }
  return week;
}

/** What actually gets saved: closed days carry no windows. */
function payload(week: Week) {
  return ORDER.map((day) => ({
    day,
    windows: week[day].enabled ? week[day].windows : [],
  }));
}

function addHour(hm: string, hours: number) {
  const [h, m] = hm.split(":").map(Number);
  const total = Math.min(h * 60 + m + hours * 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** A sensible next range: an hour after the last one ends, an hour long. */
function nextWindow(windows: Window[]): Window {
  const last = windows[windows.length - 1];
  if (!last) return DEFAULT_WINDOW;
  const startTime = addHour(last.endTime, 1);
  return { startTime, endTime: addHour(startTime, 1) };
}

function dayError(day: Day) {
  if (!day.enabled) return null;
  const result = validateWindows(day.windows);
  return "error" in result ? result.error : null;
}

export function WeeklyHoursCard({
  rules,
  timeZone,
}: {
  rules: AvailabilityRule[];
  timeZone: string;
}) {
  const [week, setWeek] = useState<Week>(() => toWeek(rules));
  const [saved, setSaved] = useState(() => JSON.stringify(payload(toWeek(rules))));
  const [pending, start] = useTransition();

  const errors = ORDER.map((d) => dayError(week[d]));
  const invalid = errors.some(Boolean);
  const dirty = JSON.stringify(payload(week)) !== saved;
  const openDays = ORDER.filter((d) => week[d].enabled).length;

  function update(day: number, next: Partial<Day>) {
    setWeek((w) => ({ ...w, [day]: { ...w[day], ...next } }));
  }

  function setWindow(day: number, index: number, field: keyof Window, value: string) {
    update(day, {
      windows: week[day].windows.map((w, i) => (i === index ? { ...w, [field]: value } : w)),
    });
  }

  function copyTo(from: number, targets: number[]) {
    setWeek((w) => {
      const next = { ...w };
      for (const d of targets) {
        if (d !== from) next[d] = { enabled: true, windows: w[from].windows.map((x) => ({ ...x })) };
      }
      return next;
    });
  }

  function save() {
    start(async () => {
      const res = await saveWeeklyHours(payload(week));
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      setSaved(JSON.stringify(payload(week)));
      toast.success("Weekly hours saved");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly hours</CardTitle>
        <CardDescription>
          When guests can book you.{" "}
          <span className="whitespace-nowrap">
            Times are in {timeZone.replace(/_/g, " ")}
            {" · "}
            <Link href="/dashboard/settings" className="text-teal-800 underline">
              change
            </Link>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {ORDER.map((day, i) => {
            const d = week[day];
            return (
              <li key={day} className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-2 py-3 sm:grid-cols-[8.5rem_1fr_auto]">
                <label className="flex items-center gap-3 pt-1.5 text-sm font-medium">
                  <Switch
                    checked={d.enabled}
                    className="data-checked:bg-teal-700"
                    onCheckedChange={(on) => update(day, { enabled: on })}
                    aria-label={`${NAMES[day]} open`}
                  />
                  <span className={d.enabled ? "" : "text-muted-foreground"}>{NAMES[day]}</span>
                </label>

                {d.enabled ? (
                  <div className="col-span-2 space-y-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    {d.windows.map((w, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          type="time"
                          step={300}
                          className="w-[8.25rem] px-2 sm:w-36 sm:px-3"
                          value={w.startTime}
                          onChange={(e) => setWindow(day, index, "startTime", e.target.value)}
                          aria-label={`${NAMES[day]} range ${index + 1} start`}
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type="time"
                          step={300}
                          className="w-[8.25rem] px-2 sm:w-36 sm:px-3"
                          value={w.endTime}
                          onChange={(e) => setWindow(day, index, "endTime", e.target.value)}
                          aria-label={`${NAMES[day]} range ${index + 1} end`}
                        />
                        {d.windows.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Remove this time range"
                            onClick={() =>
                              update(day, { windows: d.windows.filter((_, j) => j !== index) })
                            }
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {errors[i] && <p className="text-xs text-red-600">{errors[i]}</p>}
                  </div>
                ) : (
                  <p className="col-span-2 text-sm text-muted-foreground sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:pt-1.5">
                    Unavailable
                  </p>
                )}

                <div className="flex items-center gap-1 sm:col-start-3 sm:row-start-1">
                  {d.enabled && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Add another time range"
                        title="Add another time range (split shift)"
                        disabled={d.windows.length >= MAX_WINDOWS_PER_DAY}
                        onClick={() => update(day, { windows: [...d.windows, nextWindow(d.windows)] })}
                      >
                        <Plus className="size-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Copy ${NAMES[day]} hours to other days`}
                            title="Copy these hours to other days"
                          >
                            <Copy className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => copyTo(day, WEEKDAYS)}>
                            Copy to weekdays
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => copyTo(day, ORDER)}>
                            Copy to every day
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {openDays === 0 ? "Closed every day" : `Open ${openDays} day${openDays === 1 ? "" : "s"} a week`}
        </p>
        <Button
          onClick={save}
          disabled={pending || !dirty || invalid}
          className="bg-teal-800 hover:bg-teal-900"
        >
          {pending ? "Saving…" : dirty ? "Save hours" : "Saved"}
        </Button>
      </CardFooter>
    </Card>
  );
}
