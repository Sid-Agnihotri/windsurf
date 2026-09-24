import { SignUpForm } from "@/components/auth/sign-up-form";
import { configuredProviders } from "@/lib/social-providers";

// Providers come from env vars, so this must be rendered per request, not at build time.
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return <SignUpForm providers={configuredProviders()} />;
}
