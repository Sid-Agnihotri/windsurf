import type { CalendarProvider } from "@/db/schema";

/** Sign-in providers, each of which can also supply the host's calendar. */
export const SOCIAL_PROVIDERS: CalendarProvider[] = ["google", "microsoft"];

export const PROVIDER_LABEL: Record<CalendarProvider, string> = {
  google: "Google",
  microsoft: "Microsoft",
};

export const CALENDAR_LABEL: Record<CalendarProvider, string> = {
  google: "Google Calendar",
  microsoft: "Outlook Calendar",
};

/** The scope that lets us read and write events; requested together with sign-in. */
export const CALENDAR_SCOPE: Record<CalendarProvider, string> = {
  google: "https://www.googleapis.com/auth/calendar.events",
  microsoft: "Calendars.ReadWrite",
};

export function isCalendarProvider(id: string): id is CalendarProvider {
  return (SOCIAL_PROVIDERS as string[]).includes(id);
}

/**
 * Whether the scopes stored on an account include calendar access. Users can untick it on
 * Google's consent screen, so signing in with a provider doesn't imply a calendar.
 * Providers store scopes joined with commas or spaces, and Microsoft may prefix a resource URL.
 */
export function hasCalendarScope(provider: CalendarProvider, scope: string | null) {
  if (!scope) return false;
  const wanted = CALENDAR_SCOPE[provider].toLowerCase();
  return scope
    .toLowerCase()
    .split(/[\s,]+/)
    .some((s) => {
      if (s === wanted) return true;
      if (provider === "google") return s === "https://www.googleapis.com/auth/calendar";
      return s.endsWith(`/${wanted}`);
    });
}

/** Server-only: a provider is offered once its OAuth credentials are set. */
export function providerConfigured(provider: CalendarProvider) {
  return provider === "google"
    ? Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    : Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

export function configuredProviders(): CalendarProvider[] {
  return SOCIAL_PROVIDERS.filter(providerConfigured);
}
