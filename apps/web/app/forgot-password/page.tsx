import { Suspense } from "react";
import { PasswordRecoveryPanel } from "../auth/password-recovery-panel";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <PasswordRecoveryPanel mode="forgot" />
    </Suspense>
  );
}
