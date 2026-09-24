import { SignInForm } from "@/components/auth/sign-in-form";
import { configuredProviders } from "@/lib/social-providers";

/** Messages for the `?error=` Better Auth sends back when a social sign-in fails. */
const OAUTH_ERRORS: Record<string, string> = {
  account_not_linked:
    "An account with this email already exists. Sign in with your password, then connect Google or Microsoft from Settings.",
  access_denied: "Sign-in was cancelled. Try again whenever you're ready.",
  email_not_found:
    "That account didn't share an email address, which we need to create your profile.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const notice = error
    ? (OAUTH_ERRORS[error] ?? "Could not sign in. Please try again.")
    : null;
  return <SignInForm providers={configuredProviders()} notice={notice} />;
}
