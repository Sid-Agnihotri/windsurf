"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name"));
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const username = String(fd.get("username")).toLowerCase().trim();
    const timezone =
      String(fd.get("timezone")) ||
      Intl.DateTimeFormat().resolvedOptions().timeZone;

    const { error: err } = await authClient.signUp.email({
      email,
      password,
      name,
      username,
      displayUsername: username,
      // @ts-expect-error additional field
      timezone,
    });

    setLoading(false);
    if (err) {
      setError(err.message || "Could not sign up");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#dff3ef_0%,_#f7faf9_50%)] px-4">
      <Card className="w-full max-w-md border-teal-900/10 shadow-md">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
            Join Windsurf
          </CardTitle>
          <CardDescription>
            Start on Free — one event type, ten bookings a month.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" name="name" required placeholder="Tom" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username (public URL)</Label>
              <Input
                id="username"
                name="username"
                required
                pattern="[a-zA-Z0-9_]{3,30}"
                placeholder="tom"
              />
              <p className="text-xs text-muted-foreground">
                Guests will book at /your-username
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </div>
            <input
              type="hidden"
              name="timezone"
              value={
                typeof Intl !== "undefined"
                  ? Intl.DateTimeFormat().resolvedOptions().timeZone
                  : "America/New_York"
              }
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full bg-teal-800 hover:bg-teal-900"
              disabled={loading}
            >
              {loading ? "Creating…" : "Create account"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-teal-800 underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
