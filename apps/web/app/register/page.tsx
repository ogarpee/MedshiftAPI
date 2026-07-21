import { AuthForm } from "../auth/auth-form";

export default function RegisterPage() {
  return (
    <AuthForm
      mode="register"
      eyebrow="Create access"
      heading="Create your MedShift account"
      supportingCopy="Choose whether you are joining as a healthcare worker or facility, then complete your profile after signup."
      submitLabel="Create account"
      aside={
        <>
          <p>Alberta early access</p>
          <strong>Verified care network</strong>
          <span>Credential-aware matching for facilities and healthcare professionals.</span>
        </>
      }
    />
  );
}
