import { Alert, AlertDescription } from "@/components/ui/alert";

const MESSAGES: Record<string, string> = {
  connected:
    "Calendar connected. Your busy times now block slots, and new bookings will be added to it.",
  error:
    "We couldn't connect that calendar. It may already be linked to a different Windsurf account, or you may have cancelled.",
};

/** Shown after the round trip to Google/Microsoft; `result` is the `?calendar=` query value. */
export function CalendarResultAlert({ result }: { result?: string }) {
  if (!result || !MESSAGES[result]) return null;
  return (
    <Alert variant={result === "error" ? "destructive" : "default"}>
      <AlertDescription>{MESSAGES[result]}</AlertDescription>
    </Alert>
  );
}
