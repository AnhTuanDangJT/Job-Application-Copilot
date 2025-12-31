import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { verifyPassword, signJwt } from "@/lib/auth";
import { loginSchema, validateRequestBody } from "@/lib/validation";
import { setAuthCookie } from "@/lib/cookies";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/adminConfig";

export async function POST(req: NextRequest) {
  // Rate limiting - wrap in try/catch to ensure Redis errors don't break login
  let rateLimitResult;
  try {
    rateLimitResult = await rateLimiters.auth(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }
  } catch (error) {
    // If rate limiting fails (e.g., Redis connection error), log and continue
    // Login should work even if rate limiting is unavailable
    console.warn("[LOGIN] Rate limiting error (continuing anyway):", error instanceof Error ? error.message : "Unknown error");
    // Continue with login - rate limiting is optional
  }

  const validation = await validateRequestBody(req, loginSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { email, password } = validation.data;
  
  // STEP 1: Log received body (email only, NOT password for security)
  console.log("[LOGIN] Received request body - email:", email);
  console.log("[LOGIN] Password provided:", password ? "[REDACTED]" : "undefined/null");
  
  try {
    // STEP 2: Verify database connection before proceeding
    console.log("[LOGIN] Connecting to database...");
    await connectToDatabase();
    
    // Log DB connection state after connection attempt
    const dbState = mongoose.connection.readyState;
    const dbStates = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
    console.log("[LOGIN] DB connection state:", dbState, `(${dbStates[dbState as keyof typeof dbStates] || "unknown"})`);
    
    if (dbState !== 1) {
      console.error("[LOGIN] ERROR: DB is NOT connected! State:", dbState);
      return errors.internal("Database connection error");
    }
    
    // STEP 3: User lookup
    console.log("[LOGIN] Starting user lookup for email:", email);
    const user = await User.findOne({ email }).select("+passwordHash");
    
    if (!user) {
      console.log("[LOGIN] User lookup result: null (user not found)");
      return errors.unauthorized("Invalid credentials");
    }
    
    console.log("[LOGIN] User lookup result: found user", {
      id: String(user._id),
      email: user.email,
      role: user.role,
      name: user.name,
      hasPasswordHash: !!user.passwordHash,
      emailVerified: user.emailVerified
    });
    
    if (!user.passwordHash) {
      console.error("[LOGIN] ERROR: User found but passwordHash is missing!");
      return errors.unauthorized("Invalid credentials");
    }

    // Check if email is verified
    // Existing users (where emailVerified is undefined) are treated as verified
    // New users must have emailVerified === true
    if (user.emailVerified === false) {
      console.log("[LOGIN] Email not verified for user:", email);
      return NextResponse.json(
        { error: "Email not verified", message: "Please verify your email before logging in." },
        { status: 403 }
      );
    }
    
    // STEP 4: Password comparison
    console.log("[LOGIN] Before password comparison");
    if (!password) {
      console.error("[LOGIN] ERROR: Input password is undefined or empty");
      return errors.unauthorized("Invalid credentials");
    }
    
    console.log("[LOGIN] Password hash exists:", !!user.passwordHash);
    const ok = await verifyPassword(password, user.passwordHash);
    console.log("[LOGIN] After password comparison, result:", ok);
    
    if (!ok) {
      console.log("[LOGIN] Password comparison failed - returning 401");
      return errors.unauthorized("Invalid credentials");
    }
    
    // STEP 4.5: Determine role and admin status
    // CRITICAL: Admin is determined ONLY by email, never by DB role
    // DB role should be "mentee" or "mentor" - NEVER "admin"
    const isAdmin = isAdminEmail(user.email);
    
    // CRITICAL: Admin email should NEVER be mentor - Admin is NOT a mentor
    // If admin email has "mentor" role in DB, force it to "mentee" for JWT
    // Admin status is determined by email check, not DB role
    let jwtRole: "mentee" | "mentor";
    if (isAdmin) {
      // Admin is NOT a mentor - force to "mentee" role in JWT
      jwtRole = "mentee";
      if (user.role === "mentor") {
        console.warn("[LOGIN] WARNING: Admin email has 'mentor' role in DB - this is incorrect. Admin is NOT a mentor.");
        // Optionally update DB here, but for now just log warning
      }
    } else {
      // Normalize role: ensure it's "mentee" or "mentor" (never "admin" in JWT)
      jwtRole = user.role === "mentor" ? "mentor" : "mentee";
    }
    
    // Runtime assertion: Admin cannot be mentor
    if (isAdmin && user.role === "mentor") {
      console.error("[LOGIN] INVALID STATE: Admin cannot be Mentor. Email:", user.email);
      // Force role to mentee for JWT
      jwtRole = "mentee";
    }
    
    // STEP 5: JWT generation
    console.log("[LOGIN] Before generating JWT/session");
    
    // Check JWT_SECRET before attempting to sign
    if (!process.env.JWT_SECRET) {
      console.error("[LOGIN] ERROR: JWT_SECRET is not set in environment variables");
      return errors.internal("Server configuration error");
    }
    
    // JWT payload: role is NEVER "admin", isAdmin is boolean based on email
    const token = signJwt({ 
      sub: String(user._id), 
      role: jwtRole,
      isAdmin: isAdmin
    });
    console.log("[LOGIN] JWT token generated successfully", { role: jwtRole, isAdmin });
    
    // Create response with user data
    // Return role: "admin" if user is admin, otherwise return DB role (mentee/mentor)
    // This ensures consistency with /api/auth/me endpoint
    const displayRole = isAdmin ? "admin" : (user.role as "mentee" | "mentor" | "admin");
    
    const response = NextResponse.json({
      user: { 
        id: String(user._id), 
        email: user.email, 
        role: displayRole, // "admin" if isAdmin, otherwise DB role (mentee/mentor)
        isAdmin: isAdmin, // Email-based admin status
        name: user.name 
      },
    });
    
    // Set httpOnly cookie
    setAuthCookie(response, token);
    console.log("[LOGIN] Auth cookie set, returning success response");
    
    return response;
  } catch (error) {
    // STEP 6: Detailed error logging in catch block
    const errorName = error instanceof Error ? error.name : "Unknown";
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack trace available";
    
    console.error("[LOGIN] ========== ERROR IN LOGIN ROUTE ==========");
    console.error("[LOGIN] Error name:", errorName);
    console.error("[LOGIN] Error message:", errorMessage);
    console.error("[LOGIN] Error stack:", errorStack);
    console.error("[LOGIN] ===========================================");
    
    // Return more specific error messages for database connection issues
    if (error instanceof Error) {
      // Database authentication errors
      if (errorMessage.includes("authentication failed") || errorMessage.includes("bad auth")) {
        return NextResponse.json(
          { 
            error: "Database Authentication Failed",
            message: "MongoDB authentication failed. Please verify your username and password in MongoDB Atlas."
          },
          { status: 503 }
        );
      }
      
      // Database connection string errors
      if (errorMessage.includes("MONGODB_URI") || 
          errorMessage.includes("placeholder") || 
          errorMessage.includes("Connection string") ||
          errorMessage.includes("EBADNAME") ||
          errorMessage.includes("hostname")) {
        return NextResponse.json(
          { 
            error: "Database Configuration Error",
            message: "MongoDB connection string is invalid. Please check your .env.local file and ensure MONGODB_URI is correctly configured."
          },
          { status: 503 }
        );
      }
      
      // Database timeout/IP whitelist errors
      if (errorMessage.includes("timeout") || errorMessage.includes("serverSelectionTimeoutMS")) {
        return NextResponse.json(
          { 
            error: "Database Connection Timeout",
            message: "Cannot connect to MongoDB. Please check if your IP address is whitelisted in MongoDB Atlas."
          },
          { status: 503 }
        );
      }
      
      // Other database connection errors
      if (errorMessage.includes("connection") || errorMessage.includes("ECONNREFUSED")) {
        return NextResponse.json(
          { 
            error: "Database Unavailable",
            message: "Cannot connect to database. Please check if MongoDB is running and accessible."
          },
          { status: 503 }
        );
      }
    }
    
    return errors.internal("An error occurred during login");
  }
}


