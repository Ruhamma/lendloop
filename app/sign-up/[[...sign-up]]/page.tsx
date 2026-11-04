import { SignUp } from "@clerk/nextjs";
import { AuthShell, authFormAppearance } from "../../components/AuthShell";

export default function SignUpPage() {
  return (
    <AuthShell title="Create your account" subtitle="Join your neighbors in a minute. It's free.">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={authFormAppearance}
      />
    </AuthShell>
  );
}
