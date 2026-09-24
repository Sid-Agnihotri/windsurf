import { SettingsTabs } from "@/components/dashboard/settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-teal-950">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Your profile, when you&apos;re bookable, and your calendar.
        </p>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
