import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

    return `scrypt:${salt}:${derivedKey.toString("hex")}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const [algorithm, salt, storedKey] = passwordHash.split(":");

    if (algorithm !== "scrypt" || !salt || !storedKey) {
      return false;
    }

    const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;
    const storedBuffer = Buffer.from(storedKey, "hex");

    return storedBuffer.length === derivedKey.length && timingSafeEqual(storedBuffer, derivedKey);
  }
}
