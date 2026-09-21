"use client";

import { useTransition } from "react";
import type { Plan } from "@/db/schema";
import { startConnectOnboarding, startPlanCheckout } from "@/actions/host";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BillingActions({
  plan,
  connectOnboarded,
  connectAccountId,
}: {
  plan: Plan;
  connectOnboarded: boolean;
  connectAccountId: string | null;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Upgrade subscription</CardTitle>
          <CardDescription>
            Host → Windsurf via Stripe Billing. Mock completes instantly without
            keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            disabled={pending || plan === "pro"}
            onClick={() => start(() => startPlanCheckout("pro"))}
          >
            Upgrade to Pro ($12)
          </Button>
          <Button
            variant="outline"
            disabled={pending || plan === "expert"}
            onClick={() => start(() => startPlanCheckout("expert"))}
          >
            Upgrade to Expert ($29)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stripe Connect</CardTitle>
          <CardDescription>
            Required before guests can pay you for events, deposits, or tips.
            {connectAccountId ? ` Account: ${connectAccountId}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            disabled={pending}
            className="bg-teal-800 hover:bg-teal-900"
            onClick={() => start(() => startConnectOnboarding())}
          >
            {connectOnboarded ? "Reconnect Stripe" : "Connect Stripe Express"}
          </Button>
          {connectOnboarded && (
            <p className="mt-2 text-sm text-teal-800">Connected and ready.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
