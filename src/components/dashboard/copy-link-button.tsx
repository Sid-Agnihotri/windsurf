"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard can be blocked (e.g. non-secure origin); fall back to a prompt.
          window.prompt("Copy this link:", url);
        }
      }}
    >
      {copied ? "Copied!" : "Copy link"}
    </Button>
  );
}
