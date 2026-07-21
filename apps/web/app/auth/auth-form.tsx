"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { AccountStatus, UserRole } from "@medshift/shared-types";
import styles from "./auth-form.module.css";

type AuthMode = "login" | "register";

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.Worker);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const endpoint = useMemo(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    return `${apiUrl}/auth/${mode}`;
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setUser(null);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ...(mode === "register" ? { role } : {})
      })
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "Unable to continue");
      setIsSubmitting(false);
      return;
    }

    window.localStorage.setItem("medshift.accessToken", result.accessToken);
    setUser(result.user);
    setMessage(mode === "login" ? "Signed in successfully." : "Account created. Complete your profile next.");
    setIsSubmitting(false);
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
            <input
              value={password}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
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
        {user ? (
          <div className={styles.summary}>
            <strong>{user.email}</strong>
            <span>{user.role}</span>
            <span>{user.status}</span>
          </div>
        ) : null}
      </section>

      <aside className={styles.sidePanel}>
        <div className={styles.sideContent}>
          <div className={styles.sideBrand}>
            <span>Med</span>Shift
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
