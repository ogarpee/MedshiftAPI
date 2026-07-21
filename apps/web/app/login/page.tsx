import { AuthForm } from "../auth/auth-form";

export default function LoginPage() {
  return (
    <AuthForm
      mode="login"
      eyebrow="Secure sign in"
      heading="Welcome back"
      supportingCopy="Sign in to manage shifts, credentials, and facility coverage from your MedShift account."
      submitLabel="Sign in"
      aside={
        <>
          <p>Today&apos;s coverage pulse</p>
          <strong>18 active shifts</strong>
          <span>Average fill time tracking under the 2-hour launch goal.</span>
        </>
      }
    />
  );
}
