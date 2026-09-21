"use client";

import { useState, useTransition } from "react";
import type {
  AvailabilityOverride,
  AvailabilityRule,
  HostSettings,
} from "@/db/schema";
import {
  addAvailabilityOverride,
  deleteAvailabilityOverride,
  saveAvailability,
} from "@/actions/host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AvailabilityEditor({
  rules,
  overrides,
  settings,
}: {
  rules: AvailabilityRule[];
  overrides: AvailabilityOverride[];
  settings: HostSettings;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byDay = new Map(rules.map((r) => [r.dayOfWeek, r]));

  return (
    <div className="space-y-6">
      {msg && (
        <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {msg}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
          <CardDescription>Toggle days and set open hours.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            action={(fd) => {
              start(async () => {
                const res = await saveAvailability(fd);
                if (res?.ok) setMsg("Availability saved.");
                else if (res?.error) setMsg(res.error);
              });
            }}
          >
            <div className="space-y-3">
              {DAYS.map((label, day) => {
                const rule = byDay.get(day);
                return (
                  <div
                    key={day}
                    className="grid grid-cols-[4rem_1fr_1fr_auto] items-center gap-2"
                  >
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        name={`day_${day}_enabled`}
                        defaultChecked={Boolean(rule)}
                      />
                      {label}
                    </label>
                    <Input
                      type="time"
                      name={`day_${day}_start`}
                      defaultValue={rule?.startTime ?? "09:00"}
                    />
                    <Input
                      type="time"
                      name={`day_${day}_end`}
                      defaultValue={rule?.endTime ?? "17:00"}
                    />
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Buffer before (min)</Label>
                <Input
                  name="bufferBeforeMinutes"
                  type="number"
                  min={0}
                  defaultValue={settings.bufferBeforeMinutes}
                />
              </div>
              <div className="space-y-1">
                <Label>Buffer after (min)</Label>
                <Input
                  name="bufferAfterMinutes"
                  type="number"
                  min={0}
                  defaultValue={settings.bufferAfterMinutes}
                />
              </div>
              <div className="space-y-1">
                <Label>Minimum notice (min)</Label>
                <Input
                  name="minNoticeMinutes"
                  type="number"
                  min={0}
                  defaultValue={settings.minNoticeMinutes}
                />
              </div>
            </div>

            <div className="space-y-1 sm:max-w-xs">
              <Label>Guests can change bookings until (hours before)</Label>
              <Input
                name="changeNoticeHours"
                type="number"
                min={0}
                max={720}
                defaultValue={settings.changeNoticeHours}
              />
              <p className="text-xs text-muted-foreground">
                Guests cancel or reschedule from a link in their confirmation
                email. Inside this window they&apos;re asked to contact you. Use 0
                for no limit.
              </p>
            </div>

            <Button type="submit" disabled={pending} className="bg-teal-800">
              {pending ? "Saving…" : "Save schedule"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Date overrides</CardTitle>
          <CardDescription>
            Block a day off or set custom hours for one date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 sm:grid-cols-4"
            action={(fd) => {
              start(async () => {
                const res = await addAvailabilityOverride(fd);
                if (res?.error) setMsg(res.error);
                else setMsg("Override saved.");
              });
            }}
          >
            <div className="space-y-1">
              <Label>Date</Label>
              <Input name="date" type="date" required />
            </div>
            <div className="space-y-1">
              <Label>Start</Label>
              <Input name="startTime" type="time" defaultValue="09:00" />
            </div>
            <div className="space-y-1">
              <Label>End</Label>
              <Input name="endTime" type="time" defaultValue="17:00" />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="unavailable" />
                Day off
              </label>
              <Button type="submit" size="sm" disabled={pending}>
                Add
              </Button>
            </div>
          </form>

          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overrides yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {overrides.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>
                    {o.date}
                    {o.unavailable
                      ? " — unavailable"
                      : ` — ${o.windowsJson || "custom"}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      start(async () => {
                        await deleteAvailabilityOverride(o.id);
                      })
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
