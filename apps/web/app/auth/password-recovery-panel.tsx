"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MedShiftLogo } from "@medshift/ui-components";
import { useToast } from "../toast-provider";
import styles from "./auth-form.module.css";

interface PasswordRecoveryResult {
  code?: string;
  email?: string;
  message?: string | string[];
}

type PasswordRecoveryMode = "forgot" | "reset";

interface PasswordRecoveryPanelProps {
  mode: PasswordRecoveryMode;
}

export function PasswordRecoveryPanel({ mode }: PasswordRecoveryPanelProps) {
  const { notify } = useToast();
  const searchParams = useSearchParams();
  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000", []);
  const initialEmail = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const isReset = mode === "reset";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (isReset && password !== confirmPassword) {
      const mismatchMessage = "Passwords must match.";
      setMessage(mismatchMessage);
      notify(mismatchMessage, "error");
      return;
    }

    if (isReset && !token) {
      const missingTokenMessage = "This password reset link is missing required information.";
      setMessage(missingTokenMessage);
      notify(missingTokenMessage, "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/${isReset ? "reset-password" : "forgot-password"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isReset ? { email, token, password } : { email })
      });
      const result = await readPasswordRecoveryResponse(response);
      const resultMessage = formatPasswordRecoveryMessage(result);

      setMessage(resultMessage);
      notify(resultMessage, response.ok ? "success" : "error");
      setIsComplete(response.ok);

      if (response.ok && isReset) {
        setPassword("");
        setConfirmPassword("");
      }
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <Link href="/" aria-label="MedShift home">
            <span>Med</span>Shift
          </Link>
          <span className={styles.badge}>{isReset ? "Reset password" : "Account recovery"}</span>
        </div>

        <div className={styles.heading}>
          <h1>{isReset ? "Choose a new password" : "Reset your password"}</h1>
          <p>
            {isReset
              ? "Create a new password for your MedShift account, then sign in with the updated credentials."
              : "Enter your account email and we will send a secure reset link if the account exists."}
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>

          {isReset ? (
            <>
              <label>
                New password
                <span className={styles.passwordField}>
                  <input
                    value={password}
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    type={isPasswordVisible ? "text" : "password"}
                    required
                  />
                  <button
                    aria-label={isPasswordVisible ? "Hide new password" : "Show new password"}
                    className={styles.passwordToggle}
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    type="button"
                  >
                    {isPasswordVisible ? "Hide" : "Show"}
                  </button>
                </span>
              </label>
              <label>
                Confirm password
                <span className={styles.passwordField}>
                  <input
                    value={confirmPassword}
                    minLength={8}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type={isConfirmPasswordVisible ? "text" : "password"}
                    required
                  />
                  <button
                    aria-label={isConfirmPasswordVisible ? "Hide confirmed password" : "Show confirmed password"}
                    className={styles.passwordToggle}
                    onClick={() => setIsConfirmPasswordVisible((current) => !current)}
                    type="button"
                  >
                    {isConfirmPasswordVisible ? "Hide" : "Show"}
                  </button>
                </span>
              </label>
            </>
          ) : null}

          <button className={styles.submit} type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Working..." : isReset ? "Reset password" : "Send reset link"}
          </button>
        </form>

        <div className={styles.alternate}>
          {isComplete && isReset ? <Link href="/login">Sign in</Link> : <Link href="/login">Back to sign in</Link>}
          {isReset ? (
            <>
              <span className={styles.alternateSeparator}>/</span>
              <Link href="/forgot-password">Request a new link</Link>
            </>
          ) : null}
        </div>

        {message ? <p className={styles.message}>{message}</p> : null}
      </section>

      <aside className={styles.sidePanel}>
        <div className={styles.sideContent}>
          <div className={styles.sideBrandLogo}>
            <MedShiftLogo />
          </div>
          <div className={styles.sideCopy}>
            <p>Protected recovery</p>
            <strong>Secure links, clear feedback</strong>
            <span>Password reset links are time-limited and every recovery step confirms what happened without exposing account status.</span>
          </div>
          <div className={styles.sideStats} aria-label="MedShift password recovery highlights">
            <div>
              <strong>1h</strong>
              <span>Reset window</span>
            </div>
            <div>
              <strong>8+</strong>
              <span>Characters</span>
            </div>
            <div>
              <strong>0</strong>
              <span>Native alerts</span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}

async function readPasswordRecoveryResponse(response: Response): Promise<PasswordRecoveryResult> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function formatPasswordRecoveryMessage(result: PasswordRecoveryResult) {
  if (Array.isArray(result.message)) {
    return result.message.join(" ");
  }

  return result.message ?? "Unable to continue";
}
