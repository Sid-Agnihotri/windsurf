import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { booking, eventType } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const bookingId = typeof sp.bookingId === "string" ? sp.bookingId : null;
  let title = "Booking confirmed";
  if (bookingId) {
    const [row] = await db
      .select({ title: eventType.title, status: booking.status })
      .from(booking)
      .innerJoin(eventType, eq(booking.eventTypeId, eventType.id))
      .where(eq(booking.id, bookingId))
      .limit(1);
    if (row) title = `${row.title} — ${row.status.replace("_", " ")}`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You&apos;re all set</CardTitle>
          <CardDescription>{title}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            A confirmation was emailed to you and the host (or logged if Resend
            isn&apos;t configured).
            {sp.mock ? " Completed via local Stripe mock." : ""}
          </p>
          <Button asChild>
            <Link href="/">Back to Windsurf</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
