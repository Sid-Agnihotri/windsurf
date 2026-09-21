"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelByGuest, getRescheduleSlots, rescheduleByGuest } from "@/actions/manage";
import { SlotPicker } from "@/components/booking/slot-picker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

export function ManageActions({
  token,
  hostName,
  hostTimeZone,
  canReschedule,
  paidLabel,
}: {
  token: string;
  hostName: string;
  hostTimeZone: string;
  canReschedule: boolean;
  /** e.g. "$20.00 CAD" when money was already paid, else null */
  paidLabel: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "reschedule">("idle");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function confirmReschedule() {
    if (!selected) return;
    start(async () => {
      const res = await rescheduleByGuest(token, selected);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setNotice("Your booking was moved. A confirmation email is on its way.");
      setMode("idle");
      setSelected(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      {mode === "reschedule" ? (
        <div className="space-y-4">
          <SlotPicker
            hostTimeZone={hostTimeZone}
            loadSlots={(date) => getRescheduleSlots(token, date)}
            selected={selected}
            onSelect={setSelected}
          />
          <div className="flex gap-2">
            <Button
              disabled={!selected || pending}
              onClick={confirmReschedule}
              className="bg-teal-800 hover:bg-teal-900"
            >
              {pending ? "Saving…" : "Confirm new time"}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setMode("idle");
                setSelected(null);
                setError(null);
              }}
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canReschedule && (
            <Button
              className="bg-teal-800 hover:bg-teal-900"
              disabled={pending}
              onClick={() => {
                setNotice(null);
                setMode("reschedule");
              }}
            >
              Reschedule
            </Button>
          )}
          <ConfirmDialog
            trigger={
              <Button variant="outline" disabled={pending}>
                Cancel booking
              </Button>
            }
            title="Cancel this booking?"
            description={
              <>
                This can&apos;t be undone.
                {paidLabel
                  ? ` You paid ${paidLabel}. Refunds are handled by ${hostName}, so please contact them.`
                  : ""}
              </>
            }
            confirmLabel="Yes, cancel booking"
            cancelLabel="Keep booking"
            onConfirm={async () => {
              const res = await cancelByGuest(token);
              if (res?.error) setError(res.error);
              else router.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
}
