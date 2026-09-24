"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { HostSettings } from "@/db/schema";
import { saveBookingRules } from "@/actions/host";
import {
  BUFFER_PRESETS,
  CHANGE_PRESETS,
  NOTICE_PRESETS,
  formatChangeCutoff,
  formatMinutes,
  withCurrent,
} from "@/lib/availability-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Rules = {
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  changeNoticeHours: number;
};

function Field({
  id,
  label,
  hint,
  value,
  options,
  format,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  options: number[];
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {format(n)}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function BookingRulesCard({ settings }: { settings: HostSettings }) {
  const initial: Rules = {
    bufferBeforeMinutes: settings.bufferBeforeMinutes,
    bufferAfterMinutes: settings.bufferAfterMinutes,
    minNoticeMinutes: settings.minNoticeMinutes,
    changeNoticeHours: settings.changeNoticeHours,
  };
  const [rules, setRules] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(rules) !== JSON.stringify(saved);
  const set = (key: keyof Rules) => (n: number) => setRules((r) => ({ ...r, [key]: n }));

  function save() {
    start(async () => {
      const res = await saveBookingRules(rules);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      setSaved(rules);
      toast.success("Booking rules saved");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking rules</CardTitle>
        <CardDescription>Breathing room, lead time and what guests can change.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field
          id="buffer-before"
          label="Buffer before"
          hint="Free time kept before each appointment."
          value={rules.bufferBeforeMinutes}
          options={withCurrent(BUFFER_PRESETS, rules.bufferBeforeMinutes)}
          format={formatMinutes}
          onChange={set("bufferBeforeMinutes")}
        />
        <Field
          id="buffer-after"
          label="Buffer after"
          hint="Free time kept after each appointment."
          value={rules.bufferAfterMinutes}
          options={withCurrent(BUFFER_PRESETS, rules.bufferAfterMinutes)}
          format={formatMinutes}
          onChange={set("bufferAfterMinutes")}
        />
        <Field
          id="min-notice"
          label="Minimum notice"
          hint="How far ahead guests must book."
          value={rules.minNoticeMinutes}
          options={withCurrent(NOTICE_PRESETS, rules.minNoticeMinutes)}
          format={formatMinutes}
          onChange={set("minNoticeMinutes")}
        />
        <Field
          id="change-notice"
          label="Guests can cancel or reschedule"
          hint="Closer than this, they're asked to contact you."
          value={rules.changeNoticeHours}
          options={withCurrent(CHANGE_PRESETS, rules.changeNoticeHours)}
          format={formatChangeCutoff}
          onChange={set("changeNoticeHours")}
        />
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={save} disabled={pending || !dirty} className="bg-teal-800 hover:bg-teal-900">
          {pending ? "Saving…" : dirty ? "Save rules" : "Saved"}
        </Button>
      </CardFooter>
    </Card>
  );
}
