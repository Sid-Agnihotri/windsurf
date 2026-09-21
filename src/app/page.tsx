import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#dff3ef_0%,_#f7faf9_45%,_#e8eef5_100%)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-teal-950">
          Windsurf
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild className="bg-teal-800 hover:bg-teal-900">
            <Link href="/sign-up">Start free</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-6 pb-24 pt-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-16">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[1.05] font-semibold tracking-tight text-teal-950 md:text-6xl">
            Windsurf
          </h1>
          <p className="mt-3 text-xl text-teal-900/80 md:text-2xl">
            Appointment booking for solo service businesses.
          </p>
          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
            Create events, share your link, and let guests pick a slot.
            Upgrade when you need paid bookings, tips, and deposits.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-teal-800 hover:bg-teal-900">
              <Link href="/sign-up">Create your booking page</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in">I already have an account</Link>
            </Button>
          </div>
        </div>
        <div
          className="relative min-h-[280px] overflow-hidden rounded-none bg-[linear-gradient(135deg,#0f766e_0%,#134e4a_40%,#1e3a5f_100%)] shadow-xl md:min-h-[360px]"
          aria-hidden
        >
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_20%,#99f6e4,transparent_50%),radial-gradient(circle_at_80%_70%,#93c5fd,transparent_45%)]" />
          <div className="relative flex h-full flex-col justify-end p-8 text-teal-50">
            <p className="font-[family-name:var(--font-display)] text-3xl font-medium">
              Your calendar, their booking.
            </p>
            <p className="mt-2 text-sm text-teal-100/80">
              Free · Pro · Expert — pick what fits.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
