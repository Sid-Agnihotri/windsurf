"use client";

import { useTransition } from "react";
import { startConnectOnboarding, startPlanCheckout } from "@/actions/host";
import { Button } from "@/components/ui/button";

export function UpgradeButton({
  plan,
  label,
  primary = false,
}: {
  plan: "pro" | "expert";
  label: string;
  primary?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      variant={primary ? "default" : "outline"}
      className={primary ? "w-full bg-teal-800 hover:bg-teal-900" : "w-full"}
      onClick={() => start(() => startPlanCheckout(plan))}
    >
      {pending ? "Redirecting…" : label}
    </Button>
  );
}

export function ConnectStripeButton({ label, primary }: { label: string; primary: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      variant={primary ? "default" : "outline"}
      className={primary ? "bg-teal-800 hover:bg-teal-900" : ""}
      onClick={() => start(() => startConnectOnboarding())}
    >
      {pending ? "Redirecting…" : label}
    </Button>
  );
}
