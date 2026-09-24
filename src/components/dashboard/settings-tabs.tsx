"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/settings", label: "Profile" },
  { href: "/dashboard/settings/availability", label: "Availability" },
  { href: "/dashboard/settings/calendar", label: "Calendar" },
  { href: "/dashboard/settings/payments", label: "Payments" },
];

/** Route-based tabs for the Settings area; each tab is its own page. */
export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b" aria-label="Settings sections">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              active
                ? "border-teal-800 font-medium text-teal-900"
                : "border-transparent text-slate-600 hover:text-teal-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
