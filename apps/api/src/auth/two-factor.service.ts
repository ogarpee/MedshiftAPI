import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Model, Types } from "mongoose";
import { SessionClientType, TrustedDeviceSummary, TwoFactorChallengeResponse, TwoFactorMethod, TwoFactorStatus } from "@medshift/shared-types";
import { TrustedDevice, TrustedDeviceDocument, TwoFactorChallenge, TwoFactorChallengeDocument, TwoFactorCredential, TwoFactorCredentialDocument } from "../database/schemas/two-factor.schema";
import { User, UserDocument } from "../database/schemas/user.schema";
import { NotificationService } from "../notifications/notification.service";
import { BeginTwoFactorSetupDto, ManageTwoFactorDto, VerifyTwoFactorSetupDto } from "./dto/two-factor.dto";
import { PasswordService } from "./password.service";
import type { SessionMetadata } from "./auth.service";

const challengeLifetimeMs = 10 * 60 * 1000;
const resendCooldownMs = 60 * 1000;
const trustedDeviceLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const maxAttempts = 5;

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(TwoFactorCredential.name) private readonly credentials: Model<TwoFactorCredentialDocument>,
    @InjectModel(TwoFactorChallenge.name) private readonly challenges: Model<TwoFactorChallengeDocument>,
    @InjectModel(TrustedDevice.name) private readonly trustedDevices: Model<TrustedDeviceDocument>,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
    private readonly notifications: NotificationService
  ) {}

  async status(userId: string): Promise<TwoFactorStatus> {
    const credential = await this.credentials.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    return { enabled: Boolean(credential), method: credential?.method, recoveryCodesRemaining: credential?.recoveryCodeHashes.length ?? 0 };
  }

  async beginSetup(userId: string, dto: BeginTwoFactorSetupDto, metadata: SessionMetadata = {}) {
    const user = await this.requireUser(userId);
    if (!(await this.passwords.verify(dto.currentPassword, user.passwordHash))) throw new UnauthorizedException("Current password is incorrect.");
    const current = await this.credentials.findOne({ userId: user._id }).exec();
    if (current && (!dto.currentCode || !(await this.verifyCredentialCode(current, dto.currentCode)))) {
      throw new UnauthorizedException("Enter your current two-factor or recovery code.");
    }

    const challenge = new this.challenges({
      userId: user._id,
      purpose: "SETUP",
      method: dto.method,
      currentFactorVerified: Boolean(current),
      attempts: 0,
      expiresAt: new Date(Date.now() + challengeLifetimeMs),
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress
    });
    let secret: string | undefined;
    if (dto.method === TwoFactorMethod.Totp) {
      secret = encodeBase32(randomBytes(20));
      const encrypted = this.encrypt(secret);
      challenge.pendingEncryptedSecret = encrypted.value;
      challenge.pendingSecretIv = encrypted.iv;
      challenge.pendingSecretTag = encrypted.tag;
    } else {
      const code = this.createCode();
      challenge.codeHash = this.hash(code);
      challenge.sentAt = new Date();
      await this.notifications.sendTwoFactorCode(user.email, code, 10);
    }
    await challenge.save();
    return {
      setupId: challenge.id,
      method: dto.method,
      expiresAt: challenge.expiresAt.toISOString(),
      ...(secret ? { manualKey: secret, otpauthUri: this.otpAuthUri(user.email, secret) } : { maskedEmail: maskEmail(user.email) })
    };
  }

  async verifySetup(userId: string, dto: VerifyTwoFactorSetupDto) {
    const challenge = await this.requireChallenge(dto.setupId, userId, "SETUP");
    const valid = challenge.method === TwoFactorMethod.Email
      ? challenge.codeHash === this.hash(dto.code)
      : this.verifyTotp(this.decryptChallengeSecret(challenge), dto.code);
    await this.recordAttemptOrThrow(challenge, valid);
    const recoveryCodes = createRecoveryCodes();
    const credentialData: Partial<TwoFactorCredential> = {
      method: challenge.method,
      recoveryCodeHashes: recoveryCodes.map((code) => this.hash(normalizeRecoveryCode(code))),
      enabledAt: new Date(),
      encryptedSecret: challenge.pendingEncryptedSecret,
      secretIv: challenge.pendingSecretIv,
      secretTag: challenge.pendingSecretTag
    };
    await this.credentials.updateOne(
      { userId: challenge.userId },
      {
        $set: credentialData,
        ...(challenge.method === TwoFactorMethod.Email ? { $unset: { encryptedSecret: 1, secretIv: 1, secretTag: 1 } } : {})
      },
      { upsert: true }
    ).exec();
    challenge.consumedAt = new Date();
    await challenge.save();
    await this.trustedDevices.updateMany({ userId: challenge.userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }).exec();
    const user = await this.requireUser(userId);
    await this.notifications.sendSecurityAlert({ userId, email: user.email, title: "Two-factor authentication updated", body: `${challenge.method === TwoFactorMethod.Totp ? "Authenticator app" : "Email"} verification is now active on your MedShift account.` });
    return { enabled: true, method: challenge.method, recoveryCodes };
  }

  async prepareLogin(user: UserDocument, clientType: SessionClientType, trustedToken: string | undefined, metadata: SessionMetadata) {
    const credential = await this.credentials.findOne({ userId: user._id }).exec();
    if (!credential) return { required: false as const };
    if (trustedToken && await this.useTrustedDevice(user._id, trustedToken, metadata)) return { required: false as const };
    const challenge = new this.challenges({
      userId: user._id, purpose: "LOGIN", method: credential.method, clientType, attempts: 0,
      expiresAt: new Date(Date.now() + challengeLifetimeMs), userAgent: metadata.userAgent, ipAddress: metadata.ipAddress
    });
    if (credential.method === TwoFactorMethod.Email) {
      const code = this.createCode();
      challenge.codeHash = this.hash(code);
      challenge.sentAt = new Date();
      await this.notifications.sendTwoFactorCode(user.email, code, 10);
    }
    await challenge.save();
    const response: TwoFactorChallengeResponse = {
      twoFactorRequired: true,
      challengeId: challenge.id,
      method: credential.method,
      expiresAt: challenge.expiresAt.toISOString(),
      ...(credential.method === TwoFactorMethod.Email ? { maskedEmail: maskEmail(user.email) } : {})
    };
    return { required: true as const, response };
  }

  async consumeLoginChallenge(challengeId: string, code: string, trustDevice: boolean, metadata: SessionMetadata) {
    const challenge = await this.requireChallenge(challengeId, undefined, "LOGIN");
    const credential = await this.credentials.findOne({ userId: challenge.userId }).exec();
    if (!credential) throw new UnauthorizedException("Two-factor authentication is no longer enabled.");
    const valid = await this.verifyCredentialCode(credential, code, challenge);
    await this.recordAttemptOrThrow(challenge, valid);
    challenge.consumedAt = new Date();
    await challenge.save();
    const trustedDeviceToken = trustDevice ? await this.createTrustedDevice(challenge.userId, challenge.clientType ?? SessionClientType.Web, metadata) : undefined;
    return { userId: challenge.userId.toString(), clientType: challenge.clientType ?? SessionClientType.Web, trustedDeviceToken };
  }

  async resend(challengeId: string) {
    const challenge = await this.requireChallenge(challengeId, undefined, "LOGIN");
    if (challenge.method !== TwoFactorMethod.Email) throw new BadRequestException("Authenticator codes cannot be resent.");
    const elapsed = Date.now() - (challenge.sentAt?.getTime() ?? 0);
    if (elapsed < resendCooldownMs) return { sent: false, retryAfterSeconds: Math.ceil((resendCooldownMs - elapsed) / 1000) };
    const user = await this.requireUser(challenge.userId.toString());
    const code = this.createCode();
    challenge.codeHash = this.hash(code);
    challenge.sentAt = new Date();
    challenge.attempts = 0;
    await challenge.save();
    await this.notifications.sendTwoFactorCode(user.email, code, 10);
    return { sent: true };
  }

  async sendManagementCode(userId: string) {
    const user = await this.requireUser(userId);
    const credential = await this.credentials.findOne({ userId: user._id }).exec();
    if (!credential || credential.method !== TwoFactorMethod.Email) throw new BadRequestException("Email two-factor authentication is not active.");
    const elapsed = Date.now() - (credential.managementCodeSentAt?.getTime() ?? 0);
    if (elapsed < resendCooldownMs) return { sent: false, retryAfterSeconds: Math.ceil((resendCooldownMs - elapsed) / 1000) };
    const code = this.createCode();
    credential.managementCodeHash = this.hash(code);
    credential.managementCodeExpiresAt = new Date(Date.now() + challengeLifetimeMs);
    credential.managementCodeSentAt = new Date();
    await credential.save();
    await this.notifications.sendTwoFactorCode(user.email, code, 10);
    return { sent: true, maskedEmail: maskEmail(user.email) };
  }

  async disable(userId: string, dto: ManageTwoFactorDto) {
    const { user, credential } = await this.authorizeManagement(userId, dto);
    await Promise.all([
      this.credentials.deleteOne({ _id: credential._id }).exec(),
      this.revokeAllTrusted(user._id)
    ]);
    await this.notifications.sendSecurityAlert({ userId, email: user.email, title: "Two-factor authentication disabled", body: "Two-factor authentication was disabled on your MedShift account." });
    return { enabled: false, message: "Two-factor authentication disabled." };
  }

  async regenerateRecoveryCodes(userId: string, dto: ManageTwoFactorDto) {
    const { user, credential } = await this.authorizeManagement(userId, dto);
    const recoveryCodes = createRecoveryCodes();
    credential.recoveryCodeHashes = recoveryCodes.map((code) => this.hash(normalizeRecoveryCode(code)));
    await credential.save();
    await this.notifications.sendSecurityAlert({ userId, email: user.email, title: "Recovery codes regenerated", body: "New two-factor recovery codes were generated for your MedShift account." });
    return { recoveryCodes };
  }

  async listTrustedDevices(userId: string): Promise<TrustedDeviceSummary[]> {
    const items = await this.trustedDevices.find({ userId: new Types.ObjectId(userId), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).sort({ lastUsedAt: -1 }).lean().exec();
    return items.map((item) => ({ id: item._id.toString(), clientType: item.clientType, label: item.label, lastUsedAt: item.lastUsedAt.toISOString(), expiresAt: item.expiresAt.toISOString() }));
  }

  async revokeTrustedDevice(userId: string, deviceId: string) {
    if (!Types.ObjectId.isValid(deviceId)) throw new NotFoundException("Trusted device not found.");
    const result = await this.trustedDevices.updateOne({ _id: deviceId, userId: new Types.ObjectId(userId), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }).exec();
    if (!result.modifiedCount) throw new NotFoundException("Trusted device not found.");
    return { message: "Trusted device removed." };
  }

  async revokeAllTrusted(userId: string | Types.ObjectId) {
    await this.trustedDevices.updateMany({ userId: new Types.ObjectId(userId), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }).exec();
  }

  private async authorizeManagement(userId: string, dto: ManageTwoFactorDto) {
    const user = await this.requireUser(userId);
    if (!(await this.passwords.verify(dto.currentPassword, user.passwordHash))) throw new UnauthorizedException("Current password is incorrect.");
    const credential = await this.credentials.findOne({ userId: user._id }).exec();
    if (!credential || !(await this.verifyCredentialCode(credential, dto.code))) throw new UnauthorizedException("Two-factor code is incorrect.");
    return { user, credential };
  }

  private async verifyCredentialCode(credential: TwoFactorCredentialDocument, code: string, challenge?: TwoFactorChallengeDocument) {
    const normalized = normalizeRecoveryCode(code);
    const recoveryHash = this.hash(normalized);
    const recoveryIndex = credential.recoveryCodeHashes.indexOf(recoveryHash);
    if (recoveryIndex >= 0) {
      credential.recoveryCodeHashes.splice(recoveryIndex, 1);
      await credential.save();
      return true;
    }
    if (credential.method === TwoFactorMethod.Email) {
      if (challenge?.codeHash) return challenge.codeHash === this.hash(code);
      const valid = Boolean(credential.managementCodeHash === this.hash(code) && credential.managementCodeExpiresAt && credential.managementCodeExpiresAt.getTime() > Date.now());
      if (valid) {
        credential.managementCodeHash = undefined;
        credential.managementCodeExpiresAt = undefined;
        credential.managementCodeSentAt = undefined;
        await credential.save();
      }
      return valid;
    }
    if (!credential.encryptedSecret || !credential.secretIv || !credential.secretTag) return false;
    return this.verifyTotp(this.decrypt(credential.encryptedSecret, credential.secretIv, credential.secretTag), code);
  }

  private async recordAttemptOrThrow(challenge: TwoFactorChallengeDocument, valid: boolean) {
    if (valid) return;
    challenge.attempts += 1;
    await challenge.save();
    if (challenge.attempts >= maxAttempts) throw new UnauthorizedException("Too many incorrect codes. Start again.");
    throw new UnauthorizedException("The security code is incorrect.");
  }

  private async requireChallenge(id: string, userId?: string, purpose?: "LOGIN" | "SETUP") {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Security challenge is invalid.");
    const query: Record<string, unknown> = { _id: id, consumedAt: { $exists: false }, expiresAt: { $gt: new Date() } };
    if (userId) query.userId = new Types.ObjectId(userId);
    if (purpose) query.purpose = purpose;
    const challenge = await this.challenges.findOne(query).exec();
    if (!challenge) throw new BadRequestException("Security challenge expired. Start again.");
    if (challenge.attempts >= maxAttempts) throw new UnauthorizedException("Too many incorrect codes. Start again.");
    return challenge;
  }

  private async requireUser(id: string) {
    const user = await this.users.findById(id).exec();
    if (!user) throw new UnauthorizedException("Sign in again.");
    return user;
  }

  private async createTrustedDevice(userId: Types.ObjectId, clientType: SessionClientType, metadata: SessionMetadata) {
    const token = randomBytes(48).toString("base64url");
    await this.trustedDevices.create({ userId, tokenHash: this.hash(token), clientType, label: deviceLabel(metadata.userAgent, clientType), userAgent: metadata.userAgent, ipAddress: metadata.ipAddress, lastUsedAt: new Date(), expiresAt: new Date(Date.now() + trustedDeviceLifetimeMs) });
    return token;
  }

  private async useTrustedDevice(userId: Types.ObjectId, token: string, metadata: SessionMetadata) {
    const device = await this.trustedDevices.findOne({ userId, tokenHash: this.hash(token), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).exec();
    if (!device) return false;
    device.lastUsedAt = new Date();
    device.ipAddress = metadata.ipAddress;
    await device.save();
    return true;
  }

  private createCode() {
    const allowDevOtps = this.config.get<string>("ALLOW_DEV_OTPS")?.toLowerCase();
    if (this.config.get<string>("NODE_ENV") !== "production" || ["true", "1", "yes"].includes(allowDevOtps ?? "")) return "123456";
    return randomInt(100000, 1000000).toString();
  }
  private hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
  private otpAuthUri(email: string, secret: string) { return `otpauth://totp/MedShift:${encodeURIComponent(email)}?secret=${secret}&issuer=MedShift&algorithm=SHA1&digits=6&period=30`; }

  private verifyTotp(secret: string, code: string) {
    if (!/^\d{6}$/.test(code)) return false;
    for (let offset = -1; offset <= 1; offset += 1) {
      const counter = Math.floor(Date.now() / 30000) + offset;
      const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(counter));
      const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
      const position = digest[digest.length - 1] & 0x0f;
      const number = (digest.readUInt32BE(position) & 0x7fffffff) % 1000000;
      const expected = number.toString().padStart(6, "0");
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
    }
    return false;
  }

  private encryptionKey() {
    const configured = this.config.get<string>("TWO_FACTOR_ENCRYPTION_KEY")?.trim();
    if (configured) {
      const key = Buffer.from(configured, "base64");
      if (key.length !== 32) throw new Error("TWO_FACTOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
      return key;
    }
    if (this.config.get<string>("NODE_ENV") === "production") throw new Error("TWO_FACTOR_ENCRYPTION_KEY is required in production");
    return createHash("sha256").update(this.config.get<string>("JWT_SECRET", "medshift-development-key")).digest();
  }

  private encrypt(value: string) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv); const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return { value: encrypted.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") }; }
  private decrypt(value: string, iv: string, tag: string) { const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(iv, "base64")); decipher.setAuthTag(Buffer.from(tag, "base64")); return Buffer.concat([decipher.update(Buffer.from(value, "base64")), decipher.final()]).toString("utf8"); }
  private decryptChallengeSecret(challenge: TwoFactorChallengeDocument) { if (!challenge.pendingEncryptedSecret || !challenge.pendingSecretIv || !challenge.pendingSecretTag) throw new BadRequestException("Authenticator setup is incomplete."); return this.decrypt(challenge.pendingEncryptedSecret, challenge.pendingSecretIv, challenge.pendingSecretTag); }
}

function encodeBase32(buffer: Buffer) { const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const byte of buffer) bits += byte.toString(2).padStart(8, "0"); let output = ""; for (let i = 0; i < bits.length; i += 5) output += alphabet[Number.parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)]; return output; }
function decodeBase32(value: string) { const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const char of value.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0"); const bytes: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(bytes); }
function normalizeRecoveryCode(value: string) { return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(); }
function createRecoveryCodes() { return Array.from({ length: 10 }, () => `${randomBytes(4).toString("hex").slice(0, 4)}-${randomBytes(4).toString("hex").slice(0, 4)}`.toUpperCase()); }
function maskEmail(email: string) { const [name, domain] = email.split("@"); return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`; }
function deviceLabel(userAgent: string | undefined, clientType: SessionClientType) { if (clientType === SessionClientType.Mobile) return "MedShift mobile app"; if (!userAgent) return "Web browser"; if (/Edg/i.test(userAgent)) return "Microsoft Edge"; if (/Chrome/i.test(userAgent)) return "Google Chrome"; if (/Safari/i.test(userAgent)) return "Safari"; if (/Firefox/i.test(userAgent)) return "Firefox"; return "Web browser"; }
