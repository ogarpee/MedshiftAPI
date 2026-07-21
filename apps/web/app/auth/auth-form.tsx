"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { AccountStatus, UserRole } from "@medshift/shared-types";
import { MedShiftLogo } from "@medshift/ui-components";
import { useToast } from "../toast-provider";
import styles from "./auth-form.module.css";

type AuthMode = "login" | "register";

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  emailVerified: boolean;
}

interface AuthApiResult {
  accessToken?: string;
  code?: string;
  email?: string;
  emailVerificationRequired?: boolean;
  message?: string | string[];
  user?: AuthUser;
}

interface AuthFormProps {
  aside: ReactNode;
  eyebrow: string;
  heading: string;
  mode: AuthMode;
  submitLabel: string;
  supportingCopy: string;
}

export function AuthForm({ aside, eyebrow, heading, mode, submitLabel, supportingCopy }: AuthFormProps) {
  const { notify } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [role, setRole] = useState<UserRole>(UserRole.Worker);
  const [message, setMessage] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000", []);
  const endpoint = useMemo(() => `${apiUrl}/auth/${mode}`, [apiUrl, mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setResendMessage("");
    setVerificationEmail("");
    setUser(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(mode === "register" ? { role } : {})
        })
      });

      const result = await readAuthResponse(response);

      if (!response.ok) {
        if (getAuthErrorCode(result) === "EMAIL_VERIFICATION_REQUIRED") {
          setVerificationEmail(result.email ?? email);
        }

        setMessage(formatAuthError(result));
        notify(formatAuthError(result), "error");
        setIsSubmitting(false);
        return;
      }

      if (result.emailVerificationRequired) {
        setVerificationEmail(result.user?.email ?? email);
        setMessage(formatAuthError(result));
        notify("Check your inbox to verify your email.", "success");
        return;
      }

      if (result.accessToken && result.user) {
        window.localStorage.setItem("medshift.accessToken", result.accessToken);
        setUser(result.user);
        setMessage(mode === "login" ? "Signed in successfully." : "Account verified. Complete your profile next.");
        notify(mode === "login" ? "Signed in successfully." : "Account verified.", "success");
      }
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Check that the API server is running and NEXT_PUBLIC_API_URL is correct.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendVerification() {
    const targetEmail = verificationEmail || email;

    if (!targetEmail) {
      setResendMessage("Enter your email address first.");
      notify("Enter your email address first.", "error");
      return;
    }

    setIsResending(true);
    setResendMessage("");

    try {
      const response = await fetch(`${apiUrl}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail })
      });
      const result = await readAuthResponse(response);

      setResendMessage(formatAuthError(result));
      notify(formatAuthError(result), response.ok ? "success" : "error");
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      setResendMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className={`${styles.authPage} ${mode === "register" ? styles.registerPage : ""}`}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <Link href="/" aria-label="MedShift home">
            <span>Med</span>Shift
          </Link>
          <span className={styles.badge}>{eyebrow}</span>
        </div>

        <div className={styles.heading}>
          <h1>{heading}</h1>
          <p>{supportingCopy}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>

          <label>
            Password
            <span className={styles.passwordField}>
              <input
                value={password}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                type={isPasswordVisible ? "text" : "password"}
                required
              />
              <button
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                className={styles.passwordToggle}
                onClick={() => setIsPasswordVisible((current) => !current)}
                type="button"
              >
                {isPasswordVisible ? "Hide" : "Show"}
              </button>
            </span>
            {mode === "login" ? (
              <Link className={styles.passwordHelp} href="/forgot-password">
                Forgot password?
              </Link>
            ) : null}
          </label>

          {mode === "register" ? (
            <label>
              Account type
              <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                <option value={UserRole.Worker}>Healthcare worker</option>
                <option value={UserRole.Facility}>Facility</option>
              </select>
            </label>
          ) : null}

          <button className={styles.submit} type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Working..." : submitLabel}
          </button>
        </form>

        <div className={styles.alternate}>
          {mode === "login" ? (
            <>
              New to MedShift? <Link href="/register">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          )}
        </div>

        {message ? <p className={styles.message}>{message}</p> : null}
        {verificationEmail ? (
          <div className={styles.verificationNotice}>
            <strong>{verificationEmail}</strong>
            <span>Email verification is required before sign in.</span>
            <button className={styles.secondaryButton} type="button" onClick={handleResendVerification} disabled={isResending}>
              {isResending ? "Sending..." : "Resend verification email"}
            </button>
            {resendMessage ? <span>{resendMessage}</span> : null}
          </div>
        ) : null}
        {user ? (
          <div className={styles.summary}>
            <strong>{user.email}</strong>
            <span>{user.role}</span>
            <span>{user.status}</span>
            <span>{user.emailVerified ? "EMAIL VERIFIED" : "EMAIL PENDING"}</span>
          </div>
        ) : null}
      </section>

      <aside className={styles.sidePanel}>
        <div className={styles.sideContent}>
          <div className={styles.sideBrandLogo}>
            <MedShiftLogo />
          </div>
          <div className={styles.sideCopy}>{aside}</div>
          <div className={styles.sideStats} aria-label="MedShift platform highlights">
            <div>
              <strong>&lt;2h</strong>
              <span>Fill goal</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Verified</span>
            </div>
            <div>
              <strong>0</strong>
              <span>Markup</span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}

async function readAuthResponse(response: Response): Promise<AuthApiResult> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function getAuthErrorCode(result: AuthApiResult) {
  return result.code;
}

function formatAuthError(result: AuthApiResult) {
  if (Array.isArray(result.message)) {
    return result.message.join(" ");
  }

  return result.message ?? "Unable to continue";
}
