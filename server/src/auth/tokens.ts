import crypto from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { verifyToken } from '@clerk/backend';

export interface VerifiedClerkToken {
  clerkUserId: string;
  email?: string;
  authTimeEpochSec?: number;
  issuedAtEpochSec?: number;
}

export type ClerkTokenVerifier = (token: string) => Promise<VerifiedClerkToken>;

export function createClerkTokenVerifier(secretKey?: string): ClerkTokenVerifier {
  return async (token: string): Promise<VerifiedClerkToken> => {
    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY is not configured');
    }
    const payload = await verifyToken(token, { secretKey });
    return {
      clerkUserId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      authTimeEpochSec: typeof payload.iat === 'number' ? payload.iat : undefined,
      issuedAtEpochSec: typeof payload.iat === 'number' ? payload.iat : undefined,
    };
  };
}

export interface SellerAccessPayload {
  sub: string; // salespersonId
  masterId: string;
  sessionId: string;
  deviceId: string;
  role: 'SELLER';
}

export async function signSellerAccessToken(
  payload: SellerAccessPayload,
  secret: string
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key);
}

export async function verifySellerAccessToken(
  token: string,
  secret: string
): Promise<SellerAccessPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  if (payload.role !== 'SELLER' || !payload.sub || !payload.masterId || !payload.sessionId) {
    throw new Error('Invalid seller token');
  }
  return {
    sub: String(payload.sub),
    masterId: String(payload.masterId),
    sessionId: String(payload.sessionId),
    deviceId: String(payload.deviceId),
    role: 'SELLER',
  };
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateSixDigitOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export async function hashPassphrase(passphrase: string): Promise<string> {
  return argon2.hash(passphrase, { type: argon2.argon2id });
}

export async function verifyPassphrase(hash: string, passphrase: string): Promise<boolean> {
  return argon2.verify(hash, passphrase);
}
