"use client";

import { useState } from "react";
import type { CalendarProvider } from "@/db/schema";
import { authClient } from "@/lib/auth-client";
import { PROVIDER_LABEL } from "@/lib/social-providers";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.33z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.17v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.17a11 11 0 0 0 0 9.88l3.67-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.17 7.06l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

/** Lets a brand-new account start in the visitor's timezone instead of a US default. */
function rememberBrowserTimezone() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz) {
    document.cookie = `browser_tz=${encodeURIComponent(tz)}; path=/; max-age=600; samesite=lax`;
  }
}

const ICONS = { google: GoogleIcon, microsoft: MicrosoftIcon };

/**
 * "Continue with Google / Microsoft". The same button signs in an existing account or
 * creates a new one, so it works on both the sign-in and sign-up pages.
 */
export function SocialButtons({ providers }: { providers: CalendarProvider[] }) {
  const [pending, setPending] = useState<CalendarProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (providers.length === 0) return null;

  async function start(provider: CalendarProvider) {
    setError(null);
    setPending(provider);
    rememberBrowserTimezone();
    const { error: err } = await authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
      // First-time visitors land on Settings to check the username and timezone we picked for them.
      newUserCallbackURL: "/dashboard/settings?welcome=1",
      errorCallbackURL: "/sign-in",
    });
    // On success the browser is already navigating to the provider.
    if (err) {
      setPending(null);
      setError(err.message || `Could not start ${PROVIDER_LABEL[provider]} sign-in`);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {providers.map((provider) => {
        const Icon = ICONS[provider];
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={pending !== null}
            onClick={() => start(provider)}
          >
            <Icon />
            {pending === provider
              ? `Redirecting to ${PROVIDER_LABEL[provider]}…`
              : `Continue with ${PROVIDER_LABEL[provider]}`}
          </Button>
        );
      })}
      <p className="text-center text-xs text-muted-foreground">
        We&apos;ll also ask to see your calendar so bookings never clash with your
        other plans. You can skip that on the consent screen.
      </p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or use email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
