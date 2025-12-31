"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  role: "mentee" | "mentor" | "admin"; // Role from /api/auth/me - "admin" for admin users
  isAdmin: boolean; // true only if email === ADMIN_EMAIL
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        
        // Validate role is a valid enum value
        const validRoles = ["mentee", "mentor", "admin"];
        const userRole = validRoles.includes(data.role) ? data.role : "mentee";
        
        // Log warning if role is missing or unknown (dev mode only)
        if (process.env.NODE_ENV === "development" && !validRoles.includes(data.role)) {
          console.warn(`[AuthContext] Unknown role for user ${data.email}: ${data.role}. Defaulting to mentee.`);
        }
        
        setUser({
          id: data.id,
          email: data.email,
          role: userRole as "mentee" | "mentor" | "admin", // Use role from API (single source of truth)
          isAdmin: data.isAdmin || false, // Email-based admin status
          name: data.name,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth fetch error:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user ONCE on mount
  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        refetch: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
