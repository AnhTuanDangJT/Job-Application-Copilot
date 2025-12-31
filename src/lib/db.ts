import mongoose, { Mongoose } from "mongoose";

type GlobalWithMongoose = typeof globalThis & {
  _mongoose: { conn: Mongoose | null; promise: Promise<Mongoose> | null; retryCount: number };
};

const globalWithMongoose = global as GlobalWithMongoose;

// Initialize global mongoose cache if not exists
if (!globalWithMongoose._mongoose) {
  globalWithMongoose._mongoose = { conn: null, promise: null, retryCount: 0 };
}

// Maximum retry attempts for database connection
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // 1 second between retries

/**
 * Connect to MongoDB with singleton pattern and retry logic
 * Prevents multiple connections in dev mode (hot reload)
 * 
 * @returns Mongoose connection instance
 */
export async function connectToDatabase(): Promise<Mongoose> {
  const cached = globalWithMongoose._mongoose;
  
  // Return existing connection if available and connected
  if (cached.conn) {
    const dbState = mongoose.connection.readyState;
    if (dbState === 1) {
      // Connection is ready (1 = connected)
      return cached.conn;
    } else if (dbState === 2) {
      // Connection is in progress (2 = connecting)
      // Wait for the existing promise to resolve
      if (cached.promise) {
        return await cached.promise;
      }
    } else {
      // Connection is disconnected or disconnecting (0 or 3)
      // Reset connection state and reconnect
      console.warn("[DB] Existing connection is not ready (state:", dbState, "), reconnecting...");
      cached.conn = null;
      cached.promise = null;
      cached.retryCount = 0;
    }
  }

  const uri = process.env.MONGODB_URI;
  
  // Validate MONGODB_URI is set
  if (!uri) {
    throw new Error("MONGODB_URI is not set in environment variables. Please check your .env.local file.");
  }
  
  // Check for placeholder values in connection string (only check for exact placeholder patterns)
  // Only flag if we see actual placeholder text, not legitimate connection strings
  const placeholderPatterns = [
    "<user>", "<pass>", "<cluster-url>", 
    "YOUR_USERNAME", "YOUR_PASSWORD", "YOUR_CLUSTER",
    "replace-with", "changeme"
  ];
  
  const hasPlaceholders = placeholderPatterns.some(pattern => uri.includes(pattern));
  
  if (hasPlaceholders) {
    throw new Error(
      "MONGODB_URI contains placeholder values. Please replace placeholders with actual values:\n" +
      "- Replace <user> or YOUR_USERNAME with your MongoDB username\n" +
      "- Replace <pass> or YOUR_PASSWORD with your MongoDB password\n" +
      "- Replace <cluster-url> or YOUR_CLUSTER with your actual MongoDB cluster URL\n" +
      "Example: mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/database?retryWrites=true&w=majority"
    );
  }
  
  // Mask password for logging
  const maskedUri = uri.replace(
    /(mongodb\+srv:\/\/)([^:]+):([^@]+)(@.+)/,
    (match, prefix, user, pass, suffix) => {
      return prefix + user + ":*****" + suffix;
    }
  );

  console.log("[DB] Connecting with:", maskedUri);

  // Helper function to create connection with retry logic
  const attemptConnection = async (): Promise<Mongoose> => {
    const startTime = Date.now();
    
    try {
      const connection = await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000, // Increased to 10 seconds
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        retryWrites: true,
        retryReads: true,
      });
      
      const duration = Date.now() - startTime;
      console.log(`[DB] Connection successful in ${duration}ms`);
      
      // Verify connection state
      const dbState = mongoose.connection.readyState;
      const dbStates: Record<number, string> = { 
        0: "disconnected", 
        1: "connected", 
        2: "connecting", 
        3: "disconnecting" 
      };
      console.log("[DB] Connection state:", dbState, `(${dbStates[dbState] || "unknown"})`);
      
      if (dbState !== 1) {
        console.warn("[DB] WARNING: Connection resolved but state is not 'connected'");
      }
      
      return connection;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Enhanced error handling with specific messages
      if (error instanceof Error) {
        if (errorMessage.includes("authentication failed") || 
            errorMessage.includes("bad auth") || 
            errorMessage.includes("Authentication failed")) {
          const uriMatch = uri.match(/mongodb\+srv?:\/\/([^:]+):([^@]+)@(.+)/);
          const username = uriMatch ? uriMatch[1] : 'unknown';
          const hostname = uriMatch ? uriMatch[3].split('/')[0] : 'unknown';
          
          console.error(`[DB] Authentication failed after ${duration}ms for user:`, username);
          console.error("[DB] Hostname:", hostname);
          
          throw new Error(
            "MongoDB authentication failed. Please verify:\n" +
            "1. Username and password are correct in MONGODB_URI\n" +
            "2. Password special characters are URL-encoded (@=%40, #=%23, $=%24, %=%25)\n" +
            "3. Database user exists in MongoDB Atlas (Database Access section)\n" +
            "4. Your IP is whitelisted (Network Access section)"
          );
        }
        
        if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
          console.error(`[DB] DNS resolution failed after ${duration}ms`);
          throw new Error("Cannot resolve MongoDB hostname. Please check your connection string.");
        }
        
        if (errorMessage.includes("EBADNAME") || errorMessage.includes("querySrv")) {
          console.error(`[DB] Invalid hostname after ${duration}ms`);
          throw new Error(
            "MongoDB connection string has invalid hostname or contains placeholder values.\n" +
            "The connection string should look like: mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/database\n" +
            "Please check your MONGODB_URI in .env.local and ensure all placeholders are replaced with actual values."
          );
        }
        
        if (errorMessage.includes("timeout") || errorMessage.includes("serverSelectionTimeoutMS")) {
          console.error(`[DB] Connection timeout after ${duration}ms`);
          // Timeout errors are retriable
          throw error; // Will trigger retry logic
        }
      }
      
      throw error;
    }
  };

  // Retry logic with exponential backoff
  if (!cached.promise) {
    let lastError: Error | null = null;
    
    cached.promise = (async () => {
      for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        try {
          if (attempt > 0) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
            console.log(`[DB] Retry attempt ${attempt}/${MAX_RETRY_ATTEMPTS} after ${delay}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          const connection = await attemptConnection();
          cached.retryCount = 0; // Reset retry count on success
          return connection;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const errorMessage = lastError.message;
          
          // Don't retry on authentication/configuration errors
          const isNonRetriable = 
            errorMessage.includes("authentication failed") ||
            errorMessage.includes("bad auth") ||
            errorMessage.includes("ENOTFOUND") ||
            errorMessage.includes("EBADNAME") ||
            errorMessage.includes("placeholder") ||
            errorMessage.includes("MONGODB_URI is not set");
          
          if (isNonRetriable || attempt >= MAX_RETRY_ATTEMPTS) {
            console.error(`[DB] Connection failed after ${attempt + 1} attempt(s):`, errorMessage);
            if (attempt >= MAX_RETRY_ATTEMPTS) {
              console.error("[DB] Maximum retry attempts reached");
            }
            throw lastError;
          }
          
          console.warn(`[DB] Connection attempt ${attempt + 1} failed, will retry...`, errorMessage);
        }
      }
      
      throw lastError || new Error("Database connection failed after retries");
    })();
  }

  try {
    cached.conn = await cached.promise;
    console.log("[DB] Connection ready for use");
    return cached.conn;
  } catch (error) {
    // Reset promise on final failure to allow retry on next call
    cached.promise = null;
    cached.retryCount = 0;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("[DB] ========== CONNECTION FAILURE ==========");
    console.error("[DB] Error message:", errorMessage);
    if (errorStack) {
      console.error("[DB] Error stack:", errorStack);
    }
    console.error("[DB] ========================================");
    
    throw error;
  }
}


