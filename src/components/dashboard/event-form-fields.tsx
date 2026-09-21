import type { EventType } from "@/db/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function EventFormFields({
  paidAllowed,
  connectOnboarded,
  defaults,
}: {
  paidAllowed: boolean;
  connectOnboarded: boolean;
  defaults?: EventType;
}) {
  return (
    <>
      <div className="space-y-1 sm:col-span-2">
        <Label>Title</Label>
        <Input name="title" required defaultValue={defaults?.title} />
      </div>
      {!defaults && (
        <div className="space-y-1 sm:col-span-2">
          <Label>Slug (optional)</Label>
          <Input name="slug" placeholder="auto from title" />
        </div>
      )}
      <div className="space-y-1 sm:col-span-2">
        <Label>Description</Label>
        <Textarea name="description" defaultValue={defaults?.description ?? ""} />
      </div>
      <div className="space-y-1">
        <Label>Duration (minutes)</Label>
        <Input
          name="durationMinutes"
          type="number"
          min={5}
          defaultValue={defaults?.durationMinutes ?? 30}
        />
      </div>
      <div className="space-y-1">
        <Label>Location type</Label>
        <select
          name="locationType"
          className="flex h-9 w-full rounded-md border px-3 text-sm"
          defaultValue={defaults?.locationType ?? "in_person"}
        >
          <option value="in_person">In person</option>
          <option value="phone">Phone</option>
          <option value="link">Link</option>
        </select>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label>Location details</Label>
        <Input
          name="locationValue"
          defaultValue={defaults?.locationValue ?? ""}
          placeholder="Address, phone, or meeting URL"
        />
      </div>
      <div className="space-y-1">
        <Label>Pricing</Label>
        <select
          name="pricingMode"
          className="flex h-9 w-full rounded-md border px-3 text-sm"
          defaultValue={defaults?.pricingMode ?? "free"}
          disabled={!paidAllowed}
        >
          <option value="free">Free</option>
          <option value="paid" disabled={!paidAllowed}>
            Paid (full)
          </option>
          <option value="deposit" disabled={!paidAllowed}>
            Deposit
          </option>
        </select>
        {!paidAllowed && (
          <p className="text-xs text-amber-700">Upgrade to Pro for paid / deposit.</p>
        )}
        {paidAllowed && !connectOnboarded && (
          <p className="text-xs text-amber-700">
            Card payments and tips need Stripe Connect (Billing). Cash works
            without it.
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label>Full price (CAD)</Label>
        <Input
          name="price"
          type="number"
          step="0.01"
          min={0}
          defaultValue={((defaults?.priceCents ?? 0) / 100).toFixed(2)}
          disabled={!paidAllowed}
        />
      </div>
      <div className="space-y-1">
        <Label>Deposit due at booking (CAD)</Label>
        <Input
          name="deposit"
          type="number"
          step="0.01"
          min={0}
          defaultValue={((defaults?.depositCents ?? 0) / 100).toFixed(2)}
          disabled={!paidAllowed}
        />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="acceptCash"
          defaultChecked={defaults?.acceptCash}
          disabled={!paidAllowed}
        />
        Accept cash (guest can choose to pay in person)
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="tipsEnabled"
          defaultChecked={defaults?.tipsEnabled}
          disabled={!paidAllowed}
        />
        Allow tips (paid by card)
      </label>
      {defaults && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={defaults.active} />
          Active
        </label>
      )}
    </>
  );
}
