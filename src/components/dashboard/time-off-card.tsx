"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addTimeOff, removeTimeOff } from "@/actions/host";
import {
  formatDateRange,
  formatTime,
  type TimeOffGroup,
} from "@/lib/availability-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function describe(g: TimeOffGroup) {
  return g.unavailable
    ? "Unavailable"
    : g.windows.map((w) => `${formatTime(w.startTime)} – ${formatTime(w.endTime)}`).join(", ") ||
        "Custom hours";
}

function AddTimeOffDialog({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [mode, setMode] = useState<"day_off" | "custom_hours">("day_off");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await addTimeOff({ startDate, endDate, mode, startTime, endTime });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      const days = res.days ?? 0;
      const existing = res.existingBookings ?? 0;
      toast.success(days === 1 ? "Time off added" : `Time off added for ${days} days`);
      if (existing > 0) {
        toast.warning(
          `You already have ${existing} booking${existing === 1 ? "" : "s"} in this period. They stay booked, so cancel or reschedule them from Bookings if needed.`,
          { duration: 10000 }
        );
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-teal-800 hover:bg-teal-900">
          <Plus className="size-4" /> Add time off
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add time off</DialogTitle>
            <DialogDescription>
              Block whole days, or change your hours for a date or a run of dates.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="off-from">From</Label>
              <Input
                id="off-from"
                type="date"
                required
                min={today}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="off-to">To (inclusive)</Label>
              <Input
                id="off-to"
                type="date"
                required
                min={startDate || today}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex rounded-md border p-0.5 text-sm" role="group" aria-label="Type">
              {(
                [
                  ["day_off", "Unavailable all day"],
                  ["custom_hours", "Custom hours"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={`rounded px-3 py-1 ${mode === value ? "bg-teal-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "custom_hours" && (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  step={300}
                  className="w-[8.25rem] px-2 sm:w-36 sm:px-3"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  aria-label="Start time"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  step={300}
                  className="w-[8.25rem] px-2 sm:w-36 sm:px-3"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  aria-label="End time"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {mode === "day_off"
                ? "Guests can't book any time on these dates."
                : "These hours replace your usual weekly hours on these dates."}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="bg-teal-800 hover:bg-teal-900">
              {pending ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TimeOffCard({ groups, today }: { groups: TimeOffGroup[]; today: string }) {
  const [pending, start] = useTransition();

  function remove(g: TimeOffGroup) {
    start(async () => {
      const res = await removeTimeOff(g.ids);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success("Removed");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time off &amp; special hours</CardTitle>
        <CardDescription>Holidays, trips and one-off changes.</CardDescription>
        <CardAction>
          <AddTimeOffDialog today={today} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nothing coming up. Your weekly hours apply every week.
          </p>
        ) : (
          <ul className="divide-y">
            {groups.map((g) => (
              <li key={g.ids[0]} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{formatDateRange(g.startDate, g.endDate)}</p>
                  <p className="text-muted-foreground">{describe(g)}</p>
                </div>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(g)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
