"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Laptop, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TrustedDeviceSummary, TwoFactorMethod, TwoFactorStatus } from "@medshift/shared-types";
import { apiFetch } from "../../session-fetch";
import { useToast } from "../../toast-provider";

type Setup = { setupId: string; method: TwoFactorMethod; expiresAt: string; manualKey?: string; otpauthUri?: string; maskedEmail?: string };

export function SecuritySettings({ apiUrl }: { apiUrl: string }) {
  const { notify } = useToast();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [devices, setDevices] = useState<TrustedDeviceSummary[]>([]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [method, setMethod] = useState<TwoFactorMethod>(TwoFactorMethod.Totp);
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentCode, setCurrentCode] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statusResponse, devicesResponse] = await Promise.all([apiFetch(`${apiUrl}/auth/2fa`), apiFetch(`${apiUrl}/auth/trusted-devices`)]);
      if (!statusResponse.ok || !devicesResponse.ok) throw new Error();
      const nextStatus = await statusResponse.json() as TwoFactorStatus;
      setStatus(nextStatus); setMethod(nextStatus.method ?? TwoFactorMethod.Totp); setDevices(await devicesResponse.json() as TrustedDeviceSummary[]);
    } catch { notify("Security settings could not be loaded. Try again shortly.", "error"); }
  }, [apiUrl, notify]);
  useEffect(() => { void load(); }, [load]);

  async function beginSetup() {
    if (currentPassword.length < 8) return notify("Enter your current password.", "error");
    if (status?.enabled && !currentCode.trim()) return notify("Enter your current two-factor or recovery code.", "error");
    setBusy(true);
    try {
      const response = await apiFetch(`${apiUrl}/auth/2fa/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, currentPassword, currentCode: currentCode || undefined }) });
      const result = await response.json();
      if (!response.ok) throw new Error(apiMessage(result));
      setSetup(result as Setup); setVerificationCode("");
    } catch (error) { notify(error instanceof Error ? error.message : "Two-factor setup could not start.", "error"); }
    finally { setBusy(false); }
  }

  async function sendManagementCode() {
    try {
      const response = await apiFetch(`${apiUrl}/auth/2fa/manage-code`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(apiMessage(result));
      notify(result.sent === false ? `A code was sent recently. Try again in ${result.retryAfterSeconds} seconds.` : "A security code was sent to your email.", "info");
    } catch (error) { notify(error instanceof Error ? error.message : "Security code could not be sent.", "error"); }
  }

  async function verifySetup() {
    if (!setup || !/^\d{6}$/.test(verificationCode)) return notify("Enter a valid six-digit code.", "error");
    setBusy(true);
    try {
      const response = await apiFetch(`${apiUrl}/auth/2fa/setup/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setupId: setup.setupId, code: verificationCode }) });
      const result = await response.json(); if (!response.ok) throw new Error(apiMessage(result));
      setRecoveryCodes(result.recoveryCodes ?? []); setSetup(null); setCurrentPassword(""); setCurrentCode(""); setVerificationCode("");
      await load(); notify("Two-factor authentication is active.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "The code could not be verified.", "error"); }
    finally { setBusy(false); }
  }

  async function manage(action: "disable" | "recovery") {
    if (currentPassword.length < 8 || !currentCode.trim()) return notify("Enter your current password and two-factor code.", "error");
    setBusy(true);
    try {
      const response = await apiFetch(`${apiUrl}/auth/2fa${action === "recovery" ? "/recovery-codes" : ""}`, { method: action === "disable" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, code: currentCode }) });
      const result = await response.json(); if (!response.ok) throw new Error(apiMessage(result));
      if (result.recoveryCodes) setRecoveryCodes(result.recoveryCodes);
      setCurrentPassword(""); setCurrentCode(""); await load(); notify(action === "disable" ? "Two-factor authentication disabled." : "New recovery codes generated.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "Security settings could not be changed.", "error"); }
    finally { setBusy(false); }
  }

  async function revokeDevice(id?: string) {
    setBusy(true);
    try {
      const response = await apiFetch(`${apiUrl}/auth/trusted-devices${id ? `/${id}` : ""}`, { method: "DELETE" });
      if (!response.ok) throw new Error(); await load(); notify(id ? "Trusted device removed." : "All trusted devices removed.", "success");
    } catch { notify("Trusted devices could not be updated.", "error"); } finally { setBusy(false); }
  }

  async function logoutAll() {
    setBusy(true);
    try {
      const response = await apiFetch(`${apiUrl}/auth/logout-all`, { method: "POST" });
      if (!response.ok) throw new Error();
      notify("Signed out on all devices.", "success");
      window.setTimeout(() => window.location.replace("/login"), 500);
    } catch { notify("Unable to sign out all devices.", "error"); setBusy(false); }
  }

  return (
    <div className="security-settings-stack">
      <section className="security-settings-card">
        <div className="security-card-heading"><ShieldCheck /><div><strong>Two-factor authentication</strong><p>{status?.enabled ? `${status.method === TwoFactorMethod.Totp ? "Authenticator app" : "Email codes"} is active.` : "Add a second check when you sign in."}</p></div><span className={status?.enabled ? "security-state active" : "security-state"}>{status?.enabled ? "On" : "Off"}</span></div>
        {!setup && !recoveryCodes.length ? <>
          <div className="security-method-choice">
            <button className={method === TwoFactorMethod.Totp ? "selected" : ""} onClick={() => setMethod(TwoFactorMethod.Totp)} type="button"><KeyRound /> Authenticator app</button>
            <button className={method === TwoFactorMethod.Email ? "selected" : ""} onClick={() => setMethod(TwoFactorMethod.Email)} type="button">@ Email code</button>
          </div>
          <div className="security-inline-fields"><label>Current password<input autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} type="password" value={currentPassword} /></label>{status?.enabled ? <label>Current code<input inputMode="numeric" onChange={(event) => setCurrentCode(event.target.value)} value={currentCode} />{status.method === TwoFactorMethod.Email ? <button className="security-inline-link" onClick={() => void sendManagementCode()} type="button">Send current email code</button> : null}</label> : null}</div>
          <div className="security-actions"><button className="auth-submit" disabled={busy} onClick={() => void beginSetup()} type="button">{status?.enabled ? "Switch method" : "Enable 2FA"}</button>{status?.enabled ? <><button disabled={busy} onClick={() => void manage("recovery")} type="button"><RefreshCw /> New recovery codes</button><button className="danger-button" disabled={busy} onClick={() => void manage("disable")} type="button"><Trash2 /> Disable</button></> : null}</div>
        </> : null}
        {setup ? <div className="security-setup-step">{setup.otpauthUri ? <><QRCodeSVG aria-label="Authenticator QR code" size={180} value={setup.otpauthUri} /><p>Scan this QR code in your authenticator app, or enter the key manually.</p><code>{setup.manualKey}</code></> : <p>We sent a six-digit code to <strong>{setup.maskedEmail}</strong>.</p>}<label>Verification code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))} value={verificationCode} /></label><div className="security-actions"><button className="auth-submit" disabled={busy} onClick={() => void verifySetup()} type="button">Verify and enable</button><button onClick={() => setSetup(null)} type="button">Cancel</button></div></div> : null}
        {recoveryCodes.length ? <RecoveryCodes codes={recoveryCodes} onDone={() => setRecoveryCodes([])} /> : null}
      </section>
      <section className="security-settings-card">
        <div className="security-card-heading"><Laptop /><div><strong>Trusted devices</strong><p>Devices can skip the second factor for 30 days after a correct password.</p></div></div>
        {devices.length ? <div className="trusted-device-list">{devices.map((device) => <div key={device.id}><div><strong>{device.label}</strong><span>Last used {new Date(device.lastUsedAt).toLocaleDateString()}</span></div><button aria-label={`Remove ${device.label}`} disabled={busy} onClick={() => void revokeDevice(device.id)} type="button"><Trash2 /></button></div>)}</div> : <p className="settings-muted">No trusted devices.</p>}
        {devices.length ? <button disabled={busy} onClick={() => void revokeDevice()} type="button">Remove all trusted devices</button> : null}
        <button disabled={busy} onClick={() => void logoutAll()} type="button">Sign out on all devices</button>
      </section>
    </div>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { notify } = useToast();
  async function copy() { await navigator.clipboard.writeText(codes.join("\n")); notify("Recovery codes copied. Store them somewhere safe.", "success"); }
  return <div className="recovery-codes"><strong>Save your recovery codes</strong><p>Each code works once if you cannot access your primary method. They will not be shown again.</p><div>{codes.map((code) => <code key={code}>{code}</code>)}</div><div className="security-actions"><button onClick={() => void copy()} type="button"><Copy /> Copy codes</button><button className="auth-submit" onClick={onDone} type="button">I saved them</button></div></div>;
}

function apiMessage(result: unknown) { if (result && typeof result === "object" && "message" in result) { const value = (result as { message?: string | string[] }).message; return Array.isArray(value) ? value.join(" ") : value ?? "Request failed."; } return "Request failed."; }
