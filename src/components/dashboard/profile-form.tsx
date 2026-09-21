"use client";

import { useState, useTransition } from "react";
import type { Plan } from "@/db/schema";
import { updateProfile } from "@/actions/host";
import { canUseCustomBranding } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

export function ProfileForm({
  user,
}: {
  user: {
    name: string;
    username: string | null;
    timezone: string;
    bio: string | null;
    brandPrimaryColor: string | null;
    brandLogoUrl: string | null;
    plan: Plan;
  };
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const branding = canUseCustomBranding(user.plan);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Host profile</CardTitle>
        <CardDescription>
          Your username appears in public booking URLs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4 max-w-lg"
          action={(fd) => {
            start(async () => {
              const res = await updateProfile(fd);
              if (res?.error) setMsg(res.error);
              else setMsg("Profile saved.");
            });
          }}
        >
          {msg && (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm">{msg}</p>
          )}
          <div className="space-y-1">
            <Label>Display name</Label>
            <Input name="name" required defaultValue={user.name} />
          </div>
          <div className="space-y-1">
            <Label>Username</Label>
            <Input
              name="username"
              required
              pattern="[a-zA-Z0-9_]{3,30}"
              defaultValue={user.username ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label>Timezone</Label>
            <select
              name="timezone"
              className="flex h-9 w-full rounded-md border px-3 text-sm"
              defaultValue={user.timezone}
            >
              {[user.timezone, ...TIMEZONES.filter((t) => t !== user.timezone)].map(
                (tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Bio</Label>
            <Textarea name="bio" defaultValue={user.bio ?? ""} />
          </div>
          {branding ? (
            <>
              <div className="space-y-1">
                <Label>Brand primary color</Label>
                <Input
                  name="brandPrimaryColor"
                  placeholder="#0f766e"
                  defaultValue={user.brandPrimaryColor ?? ""}
                />
              </div>
              <div className="space-y-1">
                <Label>Brand logo URL</Label>
                <Input
                  name="brandLogoUrl"
                  placeholder="https://"
                  defaultValue={user.brandLogoUrl ?? ""}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Custom branding (logo / colors) is available on Expert.
            </p>
          )}
          <Button type="submit" disabled={pending} className="bg-teal-800">
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
