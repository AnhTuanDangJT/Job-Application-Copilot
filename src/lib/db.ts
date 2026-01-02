import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI");
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
    logged: boolean;
  } | undefined;
}

const globalCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
  logged: false,
};

export async function connectDB() {
  if (globalCache.conn) return globalCache.conn;

  if (!globalCache.promise) {
    globalCache.promise = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10, // REQUIRED for MongoDB Atlas M0
      serverSelectionTimeoutMS: 5000,
    });
  }

  globalCache.conn = await globalCache.promise;
  global.mongooseCache = globalCache;

  // Log success once after first successful connection
  if (!globalCache.logged) {
    console.log("✅ MongoDB connected (shared pool)");
    globalCache.logged = true;
  }

  return globalCache.conn;
}

// Export as connectToDatabase for backward compatibility with existing codebase
export const connectToDatabase = connectDB;


