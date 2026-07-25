"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, Eye, EyeOff, ShieldCheck, Users } from "lucide-react";
import { AccountStatus, UserRole } from "@medshift/shared-types";
import { MedShiftLogo } from "@medshift/ui-components";
import { useToast } from "../toast-provider";
import styles from "./auth-form.module.css";

type AuthMode = "login" | "register";
type RegistrationStep = "email" | "otp" | "complete" | "success";

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

interface OnboardingRouteStatus {
  completed?: boolean;
}

interface AuthFormProps {
  aside: ReactNode;
  eyebrow: string;
  heading: string;
  mode: AuthMode;
  submitLabel: string;
  supportingCopy: string;
}

const accountTypeOptions = [
  {
    role: UserRole.Worker,
    title: "Healthcare Worker",
    copy: "Find flexible shifts that match your role, location, and availability.",
    icon: <Users size={19} strokeWidth={2.2} />
  },
  {
    role: UserRole.Facility,
    title: "Facility",
    copy: "Post coverage needs and connect with verified clinical staff.",
    icon: <ShieldCheck size={19} strokeWidth={2.2} />
  }
];

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
  const [isRedirecting, setIsRedirecting] = useState(false);

  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000", []);
  const adminUrl = useMemo(() => process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001", []);
  const endpoint = useMemo(() => `${apiUrl}/auth/${mode}`, [apiUrl, mode]);
  const otp = otpDigits.join("");
  const isOtpStep = mode === "register" && registrationStep === "otp";
  const isRegistrationSuccess = mode === "register" && registrationStep === "success";
  const isSubmitDisabled = isSubmitting || (isOtpStep && otp.length !== 6);
  const profileHref = role === UserRole.Facility ? "/facility/onboarding" : "/worker/onboarding";
  const profileLabel = role === UserRole.Facility ? "Proceed to facility profile" : "Proceed to worker profile";
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
    const validationMessage = validateAuthForm();

    if (validationMessage) {
      setMessage(validationMessage);
      notify(validationMessage, "error");
      return;
    }

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
        window.localStorage.setItem("medshift.authUser", JSON.stringify(result.user));
        setUser(result.user);
        if (mode === "login") {
          setMessage("");
          setIsRedirecting(true);
          const redirectHref = await getPostLoginHref(result.user.role, {
            accessToken: result.accessToken,
            adminUrl,
            apiUrl
          });
          window.location.replace(redirectHref);
          return;
        }
        if (mode === "register") {
          notify("Registration complete.", "success");
          setRegistrationStep("success");
          setPassword("");
        }
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
    const normalizedEmail = email.trim().toLowerCase();

    if (mode === "login") {
      return fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password })
      });
    }

    if (registrationStep === "email") {
      return fetch(`${apiUrl}/auth/register/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, role })
      });
    }

    if (registrationStep === "otp") {
      return fetch(`${apiUrl}/auth/register/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, otp })
      });
    }

    return fetch(`${apiUrl}/auth/register/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, password, registrationToken, role })
    });
  }

  async function handleResendVerification() {
    const targetEmail = (verificationEmail || email).trim().toLowerCase();

    if (!targetEmail || !isValidEmail(targetEmail)) {
      setResendMessage("Enter a valid email address first.");
      notify("Enter a valid email address first.", "error");
      return;
    }

    if (mode === "register" && role === UserRole.Facility && !isFacilityWorkEmail(targetEmail)) {
      setResendMessage("Use your facility work email address to register a facility account.");
      notify("Use your facility work email address to register a facility account.", "error");
      return;
    }

    setIsResending(true);
    setResendMessage("");

    try {
      const response = await fetch(mode === "register" ? `${apiUrl}/auth/register/start` : `${apiUrl}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { email: targetEmail, role } : { email: targetEmail })
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

  function validateAuthForm() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return "Enter a valid email address.";
    }

    if (mode === "register" && role === UserRole.Facility && !isFacilityWorkEmail(normalizedEmail)) {
      return "Use your facility work email address to register a facility account.";
    }

    if (mode === "register" && registrationStep === "otp" && !/^\d{6}$/.test(otp)) {
      return "Enter the 6-digit verification code.";
    }

    if (mode === "register" && registrationStep === "success") {
      return "";
    }

    if ((mode === "login" || registrationStep === "complete") && password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    return "";
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
          <h1>{isRegistrationSuccess ? "Congratulations" : heading}</h1>
          <p>{mode === "register" ? getRegistrationStepCopy(registrationStep, email, supportingCopy) : supportingCopy}</p>
        </div>

        {isRegistrationSuccess ? (
          <div className={styles.completionCard}>
            <div className={styles.completionMark} aria-hidden="true">
              <CircleCheck size={24} />
            </div>
            <div>
              <strong>{user?.email ?? email}</strong>
              <span>{role === UserRole.Facility ? "Facility account created" : "Worker account created"}</span>
            </div>
            <ul>
              {role === UserRole.Facility ? (
                <>
                  <li>Complete your facility profile with care setting, address, and operating details.</li>
                  <li>MedShift will review your facility registration before live shift posting is enabled.</li>
                </>
              ) : (
                <>
                  <li>Complete your worker profile with location, clinical role, and availability.</li>
                  <li>Upload credentials and background-check details so MedShift can verify you for live shifts.</li>
                </>
              )}
            </ul>
            <Link className={styles.primaryLink} href={profileHref}>
              {profileLabel}
            </Link>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} ref={formRef}>
            {mode === "register" && registrationStep === "email" ? (
              <fieldset className={styles.accountTypeGroup}>
                <legend>Account type</legend>
                <input name="accountType" type="hidden" value={role} />
                <div className={styles.accountTypeGrid} aria-label="Account type">
                  {accountTypeOptions.map((option) => (
                    <button
                      aria-pressed={role === option.role}
                      className={`${styles.accountTypeCard} ${role === option.role ? styles.accountTypeCardActive : ""}`}
                      key={option.role}
                      onClick={() => setRole(option.role)}
                      type="button"
                    >
                      <span className={styles.accountTypeIcon} aria-hidden="true">{option.icon}</span>
                      <span>
                        <strong>{option.title}</strong>
                        <small>{option.copy}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {mode === "register" && registrationStep === "otp" ? (
              <div className={styles.otpGroup} aria-label="Verification code">
                {otpDigits.map((digit, index) => (
                  <input
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
                    aria-label={`Verification code digit ${index + 1}`}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    value={digit}
                  />
                ))}
              </div>
            ) : (
              <label>
                {mode === "register" && role === UserRole.Facility ? "Work email" : "Email"}
                <input
                  disabled={mode === "register" && registrationStep === "complete"}
                  value={email}
                  autoComplete="email"
                  maxLength={254}
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={mode === "register" && role === UserRole.Facility ? "name@facility.ca" : "name@example.com"}
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
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    maxLength={128}
                    minLength={8}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "login" ? "Enter your password" : "Create a password"}
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

            <button className={styles.submit} type="submit" disabled={isSubmitDisabled || isRedirecting}>
              {isRedirecting ? "Opening your workspace..." : isSubmitting ? "Working..." : submitText}
            </button>
          </form>
        )}

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

        {!isOtpStep && !isRegistrationSuccess ? (
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
        {user && mode !== "login" && !isRegistrationSuccess ? (
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

  if (step === "success") {
    return "Your account is created and your email is verified. Complete your profile so MedShift can finish role-specific verification.";
  }

  return fallback;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isFacilityWorkEmail(email: string) {
  const domain = email.split("@")[1] ?? "";
  const personalDomains = new Set([
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "icloud.com",
    "aol.com",
    "proton.me",
    "protonmail.com"
  ]);

  return Boolean(domain) && !personalDomains.has(domain);
}

function getDashboardHref(role: UserRole, adminUrl: string) {
  if (role === UserRole.Facility) {
    return "/facility";
  }

  if (role === UserRole.Admin) {
    return adminUrl;
  }

  return "/worker";
}

async function getPostLoginHref(role: UserRole, options: { accessToken: string; adminUrl: string; apiUrl: string }) {
  if (role === UserRole.Admin) {
    return withAccessTokenHash(options.adminUrl, options.accessToken);
  }

  const dashboardHref = getDashboardHref(role, options.adminUrl);
  const onboardingHref = role === UserRole.Facility ? "/facility/onboarding" : "/worker/onboarding";
  const statusPath = role === UserRole.Facility ? "facility-profiles/onboarding-status" : "worker-profiles/onboarding-status";

  try {
    const response = await fetch(`${options.apiUrl}/${statusPath}`, {
      headers: { Authorization: `Bearer ${options.accessToken}` }
    });

    if (!response.ok) {
      return onboardingHref;
    }

    const status = (await response.json()) as OnboardingRouteStatus;
    return status.completed ? dashboardHref : onboardingHref;
  } catch {
    return dashboardHref;
  }
}

function withAccessTokenHash(href: string, accessToken: string) {
  const redirectUrl = new URL(href, window.location.origin);
  redirectUrl.hash = `access_token=${encodeURIComponent(accessToken)}`;

  return redirectUrl.toString();
}
