import { redirect } from "next/navigation";

// Availability now lives under Settings; this keeps old links and bookmarks working.
export default function AvailabilityRedirect() {
  redirect("/dashboard/settings/availability");
}
