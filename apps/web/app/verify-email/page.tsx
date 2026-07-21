import { Suspense } from "react";
import { VerifyEmailPanel } from "../auth/verify-email-panel";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPanel />
    </Suspense>
  );
}
