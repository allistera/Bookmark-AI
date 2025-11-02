/**
 * JWT token generation and verification
 */

import { SignJWT, jwtVerify } from 'jose';
import { JWTPayload, TokenPair } from '../../types/auth';
import { Env } from '../../types/env';

const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

/**
 * Generate an access token
 */
export async function generateAccessToken(
  userId: string,
  email: string,
  env: Env
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  return await new SignJWT({
    sub: userId,
    email,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secret);
}

/**
 * Generate a refresh token
 */
export async function generateRefreshToken(
  userId: string,
  email: string,
  env: Env
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  return await new SignJWT({
    sub: userId,
    email,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(secret);
}

/**
 * Generate both access and refresh tokens
 */
export async function generateTokenPair(
  userId: string,
  email: string,
  env: Env
): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId, email, env),
    generateRefreshToken(userId, email, env),
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(
  token: string,
  env: Env
): Promise<JWTPayload> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Get token expiration timestamp from payload
 */
export function getTokenExpiry(payload: JWTPayload): number {
  return payload.exp;
}

/**
 * Check if token is expired
 */
export function isTokenExpired(payload: JWTPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}
