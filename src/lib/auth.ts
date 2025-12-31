import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface JwtPayload {
  sub: string; // user id
  role: "mentee" | "mentor"; // NEVER "admin" - admin is determined by email
  isAdmin: boolean; // true only if email === ADMIN_EMAIL
}

export function signJwt(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyJwt(token: string): JwtPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[verifyJwt] JWT_SECRET is not set in environment variables");
    return null;
  }
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}

export function getBearerToken(header?: string | null): string | null {
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}


