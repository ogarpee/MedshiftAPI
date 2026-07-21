import { Suspense } from "react";
import { PasswordRecoveryPanel } from "../auth/password-recovery-panel";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <PasswordRecoveryPanel mode="reset" />
    </Suspense>
  );
}
