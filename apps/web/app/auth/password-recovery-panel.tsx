"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { MedShiftLogo } from "@medshift/ui-components";
import { useToast } from "../toast-provider";
import styles from "./auth-form.module.css";

interface PasswordRecoveryResult {
  code?: string;
  email?: string;
  message?: string | string[];
}

type PasswordRecoveryMode = "forgot" | "reset";
type PasswordRecoveryStep = "email" | "otp" | "password";

interface PasswordRecoveryPanelProps {
  mode: PasswordRecoveryMode;
}

export function PasswordRecoveryPanel({ mode }: PasswordRecoveryPanelProps) {
  const { notify } = useToast();
  const searchParams = useSearchParams();
  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000", []);
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<PasswordRecoveryStep>(mode === "reset" || Boolean(initialEmail) ? "otp" : "email");
  const otp = otpDigits.join("");
  const isEmailStep = recoveryStep === "email";
  const isOtpStep = recoveryStep === "otp";
  const isPasswordStep = recoveryStep === "password";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      const emailMessage = "Enter a valid email address.";
      setMessage(emailMessage);
      notify(emailMessage, "error");
      return;
    }

    if (isEmailStep) {
      await requestResetCode(normalizedEmail);
      return;
    }

    if (isOtpStep) {
      if (!/^\d{6}$/.test(otp)) {
        const otpMessage = getResetOtpPrompt();
        setMessage(otpMessage);
        notify(otpMessage, "error");
        return;
      }

      await verifyResetCode(normalizedEmail);
      return;
    }

    if (!isPasswordStep || !/^\d{6}$/.test(otp)) {
      const otpMessage = getResetOtpPrompt();
      setMessage(otpMessage);
      notify(otpMessage, "error");
      setRecoveryStep("otp");
      return;
    }

    if (password !== confirmPassword) {
      const mismatchMessage = "Passwords must match.";
      setMessage(mismatchMessage);
      notify(mismatchMessage, "error");
      return;
    }

    if (password.length < 8) {
      const passwordMessage = "Password must be at least 8 characters.";
      setMessage(passwordMessage);
      notify(passwordMessage, "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, otp, password })
      });
      const result = await readPasswordRecoveryResponse(response);
      const resultMessage = formatPasswordRecoveryMessage(result);

      setMessage(resultMessage);
      notify(resultMessage, response.ok ? "success" : "error");
      setIsComplete(response.ok);

      if (response.ok) {
        setOtpDigits(["", "", "", "", "", ""]);
        setPassword("");
        setConfirmPassword("");
        setRecoveryStep("password");
      }
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestResetCode(normalizedEmail = email.trim().toLowerCase()) {
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail })
      });
      const result = await readPasswordRecoveryResponse(response);
      const resultMessage = formatPasswordRecoveryMessage(result);

      setMessage(resultMessage);
      notify(resultMessage, response.ok ? "success" : "error");

      if (response.ok) {
        setRecoveryStep("otp");
        setOtpDigits(["", "", "", "", "", ""]);
        setPassword("");
        setConfirmPassword("");
        setIsComplete(false);
      }
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyResetCode(normalizedEmail = email.trim().toLowerCase()) {
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/forgot-password/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, otp })
      });
      const result = await readPasswordRecoveryResponse(response);
      const resultMessage = formatPasswordRecoveryMessage(result);

      setMessage(resultMessage);
      notify(resultMessage, response.ok ? "success" : "error");

      if (response.ok) {
        setRecoveryStep("password");
        setIsComplete(false);
      }
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOtpChange(index: number, value: string, element: HTMLInputElement) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    setOtpDigits(nextDigits);

    if (digit && index < otpDigits.length - 1) {
      const nextInput = element.parentElement?.querySelector<HTMLInputElement>(`input[name="otp-${index + 2}"]`);
      nextInput?.focus();
    }
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Backspace" || otpDigits[index]) {
      return;
    }

    const previousInput = event.currentTarget.parentElement?.querySelector<HTMLInputElement>(`input[name="otp-${index}"]`);
    previousInput?.focus();
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedCode = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (pastedCode.length < 2) {
      return;
    }

    event.preventDefault();
    setOtpDigits(Array.from({ length: 6 }, (_, index) => pastedCode[index] ?? ""));
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>
            <MedShiftLogo href="/" />
          </div>
          <span className={styles.badge}>{getRecoveryStepBadge(recoveryStep)}</span>
        </div>

        <div className={styles.heading}>
          <h1>{getRecoveryStepHeading(recoveryStep)}</h1>
          <p>{getRecoveryStepCopy(recoveryStep)}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              disabled={!isEmailStep}
              maxLength={254}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          {isOtpStep ? (
            <div className={styles.otpGroup} aria-label="Password reset code">
              {otpDigits.map((digit, index) => (
                <input
                  aria-label={`Password reset code digit ${index + 1}`}
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  inputMode="numeric"
                  key={index}
                  maxLength={1}
                  name={`otp-${index + 1}`}
                  onChange={(event) => handleOtpChange(index, event.target.value, event.currentTarget)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onPaste={handleOtpPaste}
                  pattern="[0-9]*"
                  placeholder="0"
                  required
                  type="text"
                  value={digit}
                />
              ))}
            </div>
          ) : null}

          {isPasswordStep ? (
            <>
              <label>
                New password
                <span className={styles.passwordField}>
                  <input
                    value={password}
                    autoComplete="new-password"
                    maxLength={128}
                    minLength={8}
                    name="newPassword"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create a new password"
                    type={isPasswordVisible ? "text" : "password"}
                    required
                  />
                  <button
                    aria-label={isPasswordVisible ? "Hide new password" : "Show new password"}
                    className={styles.passwordToggle}
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    type="button"
                  >
                    {isPasswordVisible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                  </button>
                </span>
              </label>
              <label>
                Confirm password
                <span className={styles.passwordField}>
                  <input
                    value={confirmPassword}
                    autoComplete="new-password"
                    maxLength={128}
                    minLength={8}
                    name="confirmPassword"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm your new password"
                    type={isConfirmPasswordVisible ? "text" : "password"}
                    required
                  />
                  <button
                    aria-label={isConfirmPasswordVisible ? "Hide confirmed password" : "Show confirmed password"}
                    className={styles.passwordToggle}
                    onClick={() => setIsConfirmPasswordVisible((current) => !current)}
                    type="button"
                  >
                    {isConfirmPasswordVisible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                  </button>
                </span>
              </label>
            </>
          ) : null}

          <button className={styles.submit} type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Working..." : getRecoveryStepSubmitLabel(recoveryStep)}
          </button>
        </form>

        <div className={styles.alternate}>
          {isComplete ? <Link href="/login">Sign in</Link> : <Link href="/login">Back to sign in</Link>}
          {!isEmailStep && !isComplete ? (
            <>
              <span className={styles.alternateSeparator}>/</span>
              <button
                className={styles.textButton}
                disabled={isSubmitting}
                onClick={() => {
                  const normalizedEmail = email.trim().toLowerCase();

                  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
                    const emailMessage = "Enter a valid email address before requesting a new code.";
                    setMessage(emailMessage);
                    notify(emailMessage, "error");
                    return;
                  }

                  void requestResetCode(normalizedEmail);
                }}
                type="button"
              >
                Send a new code
              </button>
              {isPasswordStep ? (
                <>
                  <span className={styles.alternateSeparator}>/</span>
                  <button
                    className={styles.textButton}
                    disabled={isSubmitting}
                    onClick={() => {
                      setRecoveryStep("otp");
                      setPassword("");
                      setConfirmPassword("");
                      setMessage("Enter the 6-digit code again.");
                    }}
                    type="button"
                  >
                    Edit code
                  </button>
                </>
              ) : null}
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
            <strong>Secure codes, clear feedback</strong>
            <span>Password reset codes are time-limited and every recovery step confirms what happened without exposing account status.</span>
          </div>
          <div className={styles.sideStats} aria-label="MedShift password recovery highlights">
            <div>
              <strong>10m</strong>
              <span>Code window</span>
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getRecoveryStepBadge(step: PasswordRecoveryStep) {
  if (step === "email") {
    return "Account recovery";
  }

  if (step === "otp") {
    return "Reset code";
  }

  return "New password";
}

function getRecoveryStepHeading(step: PasswordRecoveryStep) {
  if (step === "email") {
    return "Reset your password";
  }

  if (step === "otp") {
    return "Enter your reset code";
  }

  return "Set your new password";
}

function getRecoveryStepCopy(step: PasswordRecoveryStep) {
  if (step === "email") {
    return "Enter your account email and we will send a 6-digit reset code if the account exists.";
  }

  if (step === "otp") {
    return getResetOtpPrompt();
  }

  return "Create a new MedShift password, then sign in with the updated credentials.";
}

function getRecoveryStepSubmitLabel(step: PasswordRecoveryStep) {
  if (step === "email") {
    return "Send reset code";
  }

  if (step === "otp") {
    return "Continue";
  }

  return "Reset password";
}

function getResetOtpPrompt() {
  return "Enter the 6-digit reset code before choosing a new password.";
}
