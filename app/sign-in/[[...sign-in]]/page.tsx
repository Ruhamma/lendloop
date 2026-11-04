import { SignIn } from "@clerk/nextjs";
import { AuthShell, authFormAppearance } from "../../components/AuthShell";

export default function SignInPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to borrow, lend and see your requests.">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        appearance={authFormAppearance}
      />
    </AuthShell>
  );
}
