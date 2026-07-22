"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MedShiftLogo } from "@medshift/ui-components";
import { useToast } from "../toast-provider";
import styles from "./auth-form.module.css";

interface VerifyEmailResult {
  code?: string;
  email?: string;
  message?: string | string[];
}

type VerificationState = "checking" | "success" | "error";

export function VerifyEmailPanel() {
  const { notify } = useToast();
  const searchParams = useSearchParams();
  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000", []);
  const initialEmail = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState("Verifying your MedShift account...");
  const [resendMessage, setResendMessage] = useState("");
  const [state, setState] = useState<VerificationState>("checking");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!initialEmail || !token) {
      setState("error");
      setMessage("This verification link is missing required information.");
      notify("This verification link is missing required information.", "error");
      return;
    }

    async function verifyEmail() {
      try {
        const response = await fetch(`${apiUrl}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: initialEmail, token })
        });
        const result = await readVerificationResponse(response);

        setState(response.ok ? "success" : "error");
        setMessage(formatVerificationMessage(result, response.ok ? "Email verified. You can now sign in." : "Unable to verify email."));
        notify(
          formatVerificationMessage(result, response.ok ? "Email verified. You can now sign in." : "Unable to verify email."),
          response.ok ? "success" : "error"
        );

        if (result.email) {
          setEmail(result.email);
        }
      } catch {
        setState("error");
        setMessage("Unable to reach the MedShift API. Try again after checking the API server.");
        notify("Unable to reach the MedShift API. Try again after checking the API server.", "error");
      }
    }

    verifyEmail();
  }, [apiUrl, initialEmail, notify, token]);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      setResendMessage("Enter a valid email address first.");
      notify("Enter a valid email address first.", "error");
      return;
    }

    setIsResending(true);
    setResendMessage("");

    try {
      const response = await fetch(`${apiUrl}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail })
      });
      const result = await readVerificationResponse(response);

      setResendMessage(formatVerificationMessage(result, "If that email belongs to an unverified account, a new verification link has been sent."));
      notify(
        formatVerificationMessage(result, "If that email belongs to an unverified account, a new verification link has been sent."),
        response.ok ? "success" : "error"
      );
    } catch {
      setResendMessage("Unable to reach the MedShift API. Try again after checking the API server.");
      notify("Unable to reach the MedShift API. Try again after checking the API server.", "error");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>
            <MedShiftLogo href="/" />
          </div>
          <span className={styles.badge}>Email verification</span>
        </div>

        <div className={styles.heading}>
          <h1>{state === "success" ? "Email verified" : "Verify your email"}</h1>
          <p>{message}</p>
        </div>

        {state === "success" ? (
          <div className={styles.verificationActions}>
            <Link className={styles.primaryLink} href="/login">
              Sign in
            </Link>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleResend}>
            <label>
              Email
              <input
                autoComplete="email"
                maxLength={254}
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <button className={styles.submit} type="submit" disabled={isResending}>
              {isResending ? "Sending..." : "Resend verification email"}
            </button>
            {resendMessage ? <p className={styles.message}>{resendMessage}</p> : null}
          </form>
        )}
      </section>

      <aside className={styles.sidePanel}>
        <div className={styles.sideContent}>
          <div className={styles.sideBrandLogo}>
            <MedShiftLogo />
          </div>
          <div className={styles.sideCopy}>
            <p>Secure access</p>
            <strong>One verified inbox for every account</strong>
            <span>Email verification keeps shift updates, approvals, and account recovery tied to the right person.</span>
          </div>
          <div className={styles.sideStats} aria-label="MedShift verification highlights">
            <div>
              <strong>24h</strong>
              <span>Link window</span>
            </div>
            <div>
              <strong>1</strong>
              <span>Active link</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Inbox gated</span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}

async function readVerificationResponse(response: Response): Promise<VerifyEmailResult> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function formatVerificationMessage(result: VerifyEmailResult, fallback: string) {
  if (Array.isArray(result.message)) {
    return result.message.join(" ");
  }

  return result.message ?? fallback;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
