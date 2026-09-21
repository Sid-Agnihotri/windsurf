"use client";

import { useState, useTransition } from "react";
import type { Plan } from "@/db/schema";
import { setUserPlan } from "@/actions/admin";

export function AdminPlanSelect({
  userId,
  plan,
}: {
  userId: string;
  plan: Plan;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <select
        className="h-8 rounded-md border bg-white px-2 text-sm"
        value={plan}
        disabled={pending}
        aria-label="Plan"
        onChange={(e) => {
          const next = e.target.value as Plan;
          start(async () => {
            const res = await setUserPlan(userId, next);
            setError(res?.error ?? null);
          });
        }}
      >
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="expert">Expert</option>
      </select>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
