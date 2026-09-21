import Link from "next/link";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { Button } from "@/components/ui/button";

export function PublicLink({
  username,
  slug,
  active,
  baseUrl,
}: {
  username: string | null;
  slug: string;
  active: boolean;
  baseUrl: string;
}) {
  if (!username) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Set a username in{" "}
        <Link href="/dashboard/settings" className="underline">
          Settings
        </Link>{" "}
        to get a shareable link for this event.
      </p>
    );
  }
  const path = `/${username}/${slug}`;
  const url = `${baseUrl}${path}`;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-slate-50 px-3 py-2">
      <code className="min-w-0 flex-1 truncate text-xs text-slate-700">
        {url}
      </code>
      <CopyLinkButton url={url} />
      <Button variant="outline" size="sm" asChild>
        <Link href={path} target="_blank">
          Open
        </Link>
      </Button>
      {!active && (
        <p className="w-full text-xs text-amber-700">
          This event is inactive, so its link won&apos;t work until you turn it
          back on.
        </p>
      )}
    </div>
  );
}
