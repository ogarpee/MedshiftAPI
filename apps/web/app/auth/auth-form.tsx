"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { AccountStatus, UserRole } from "@medshift/shared-types";
import { MedShiftLogo } from "@medshift/ui-components";
import { useToast } from "../toast-provider";
import styles from "./auth-form.module.css";

type AuthMode = "login" | "register";
type RegistrationStep = "email" | "otp" | "complete";

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
  registrationOtpRequired?: boolean;
  registrationToken?: string;
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
  const formRef = useRef<HTMLFormElement>(null);
  const lastSubmittedOtpRef = useRef("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [role, setRole] = useState<UserRole>(UserRole.Worker);
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>("email");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [registrationToken, setRegistrationToken] = useState("");
  const [message, setMessage] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000", []);
  const endpoint = useMemo(() => `${apiUrl}/auth/${mode}`, [apiUrl, mode]);
  const otp = otpDigits.join("");
  const isOtpStep = mode === "register" && registrationStep === "otp";
  const isSubmitDisabled = isSubmitting || (isOtpStep && otp.length !== 6);
  const submitText =
    mode === "register"
      ? registrationStep === "email"
        ? "Send verification code"
        : registrationStep === "otp"
          ? "Verify code"
          : submitLabel
      : submitLabel;

  useEffect(() => {
    if (!isOtpStep || isSubmitting || otp.length !== 6 || lastSubmittedOtpRef.current === otp) {
      return;
    }

    lastSubmittedOtpRef.current = otp;
    formRef.current?.requestSubmit();
  }, [isOtpStep, isSubmitting, otp]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setResendMessage("");
    setVerificationEmail("");
    setUser(null);

    try {
      const response = await submitAuthStep();

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

      if (mode === "register" && result.registrationOtpRequired) {
        setRegistrationStep("otp");
        setOtpDigits(["", "", "", "", "", ""]);
        lastSubmittedOtpRef.current = "";
        setMessage(formatAuthError(result));
        notify("Verification code sent.", "success");
        return;
      }

      if (mode === "register" && result.registrationToken) {
        setRegistrationToken(result.registrationToken);
        setRegistrationStep("complete");
        setMessage(formatAuthError(result));
        notify("Email verified. Complete your account.", "success");
        return;
      }

      if (result.accessToken && result.user) {
        window.localStorage.setItem("medshift.accessToken", result.accessToken);
        setUser(result.user);
        setMessage(mode === "login" ? "Signed in successfully." : "Registration complete. Complete your profile next.");
        notify(mode === "login" ? "Signed in successfully." : "Registration complete.", "success");
      }
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Check that the API server is running and NEXT_PUBLIC_API_URL is correct.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitAuthStep() {
    if (mode === "login") {
      return fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
    }

    if (registrationStep === "email") {
      return fetch(`${apiUrl}/auth/register/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
    }

    if (registrationStep === "otp") {
      return fetch(`${apiUrl}/auth/register/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });
    }

    return fetch(`${apiUrl}/auth/register/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, registrationToken, role })
    });
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
      const response = await fetch(mode === "register" ? `${apiUrl}/auth/register/start` : `${apiUrl}/auth/resend-verification`, {
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

  function handleOtpChange(index: number, value: string, target: HTMLInputElement) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    setOtpDigits(nextDigits);

    if (digit) {
      const nextInput = target.parentElement?.children.item(index + 1) as HTMLInputElement | null;
      nextInput?.focus();
    }
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Backspace" || otpDigits[index]) {
      return;
    }

    const previousInput = event.currentTarget.parentElement?.children.item(index - 1) as HTMLInputElement | null;
    previousInput?.focus();
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedValue = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (!pastedValue) {
      return;
    }

    event.preventDefault();
    setOtpDigits(Array.from({ length: 6 }, (_, index) => pastedValue[index] ?? ""));
  }

  return (
    <main className={`${styles.authPage} ${mode === "register" ? styles.registerPage : ""}`}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>
            <MedShiftLogo href="/" />
          </div>
          <span className={styles.badge}>{eyebrow}</span>
        </div>

        <div className={styles.heading}>
          <h1>{heading}</h1>
          <p>{mode === "register" ? getRegistrationStepCopy(registrationStep, email, supportingCopy) : supportingCopy}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} ref={formRef}>
          {mode === "register" && registrationStep === "otp" ? (
            <div className={styles.otpGroup} aria-label="Verification code">
              {otpDigits.map((digit, index) => (
                <input
                  inputMode="numeric"
                  key={index}
                  maxLength={1}
                  onChange={(event) => handleOtpChange(index, event.target.value, event.currentTarget)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onPaste={handleOtpPaste}
                  pattern="[0-9]*"
                  required
                  type="text"
                  value={digit}
                />
              ))}
            </div>
          ) : (
            <label>
              Email
              <input
                disabled={mode === "register" && registrationStep === "complete"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </label>
          )}

          {mode === "login" || registrationStep === "complete" ? (
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
                  {isPasswordVisible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                </button>
              </span>
              {mode === "login" ? (
                <Link className={styles.passwordHelp} href="/forgot-password">
                  Forgot password?
                </Link>
              ) : null}
            </label>
          ) : null}

          {mode === "register" && registrationStep === "complete" ? (
            <label>
              Account type
              <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                <option value={UserRole.Worker}>Healthcare worker</option>
                <option value={UserRole.Facility}>Facility</option>
              </select>
            </label>
          ) : null}

          <button className={styles.submit} type="submit" disabled={isSubmitDisabled}>
            {isSubmitting ? "Working..." : submitText}
          </button>
        </form>

        {mode === "register" && registrationStep === "otp" ? (
          <div className={styles.registrationActions}>
            <button className={styles.inlineButton} onClick={handleResendVerification} type="button" disabled={isResending}>
              {isResending ? "Sending..." : "Resend code"}
            </button>
            <button
              className={styles.inlineButton}
              onClick={() => {
                setRegistrationStep("email");
                setOtpDigits(["", "", "", "", "", ""]);
                lastSubmittedOtpRef.current = "";
                setMessage("");
              }}
              type="button"
            >
              Change email
            </button>
          </div>
        ) : null}

        {!isOtpStep ? (
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
        ) : null}

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

function getRegistrationStepCopy(step: RegistrationStep, email: string, fallback: string) {
  if (step === "email") {
    return "Enter your email address and we will send a 6-digit verification code.";
  }

  if (step === "otp") {
    return `Enter the 6-digit code sent to ${email}.`;
  }

  return fallback;
}
