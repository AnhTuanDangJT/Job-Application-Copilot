"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api-client";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"mentee" | "mentor">("mentee");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(getApiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setError("Server error: Invalid response format. Please try again.");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || `Registration failed (Status: ${response.status})`;
        setError(errorMessage);
        return;
      }

      // Redirect to verification page with email
      router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Server error: Invalid response. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
      {/* Enhanced background with subtle pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F8F5F2] via-[#F4E2D4] to-[#E8D5C4] opacity-100" />
      {/* Subtle abstract pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, #734C23 0%, transparent 50%),
                            radial-gradient(circle at 80% 80%, #9C6A45 0%, transparent 50%),
                            radial-gradient(circle at 40% 20%, #CAAE92 0%, transparent 50%)`,
        }}
      />
      
      {/* Auth card with entrance animation */}
      <div className="relative w-full max-w-[420px] space-y-6 md:space-y-8 rounded-2xl bg-[#F8F5F2]/95 backdrop-blur-sm p-6 md:p-10 shadow-xl border border-[#CAAE92]/20 animate-in">
        {/* Typography section */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-[#1F2937] tracking-tight">
            Create Account
          </h1>
          <p className="text-sm text-[#6B7280]/90 leading-relaxed">
            Join us to start your journey
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[#1F2937] mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-lg border border-[#CAAE92] bg-white/80 backdrop-blur-sm px-4 py-3 md:py-3 text-base md:text-sm text-[#1F2937] placeholder:text-[#6B7280]/70 focus:border-[#9C6A45] focus:ring-2 focus:ring-[#9C6A45]/20 focus:bg-white transition-all duration-150 min-h-[44px]"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#1F2937] mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border border-[#CAAE92] bg-white/80 backdrop-blur-sm px-4 py-3 md:py-3 text-base md:text-sm text-[#1F2937] placeholder:text-[#6B7280]/70 focus:border-[#9C6A45] focus:ring-2 focus:ring-[#9C6A45]/20 focus:bg-white transition-all duration-150 min-h-[44px]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#1F2937] mb-2">
              Password (min 8 characters)
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-[#CAAE92] bg-white/80 backdrop-blur-sm px-4 py-3 md:py-3 text-base md:text-sm text-[#1F2937] placeholder:text-[#6B7280]/70 focus:border-[#9C6A45] focus:ring-2 focus:ring-[#9C6A45]/20 focus:bg-white transition-all duration-150 min-h-[44px]"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-[#1F2937] mb-2">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "mentee" | "mentor")}
              className="block w-full rounded-lg border border-[#CAAE92] bg-white/80 backdrop-blur-sm px-4 py-3 md:py-3 text-base md:text-sm text-[#1F2937] focus:border-[#9C6A45] focus:ring-2 focus:ring-[#9C6A45]/20 focus:bg-white transition-all duration-150 min-h-[44px]"
            >
              <option value="mentee">Mentee</option>
              <option value="mentor">Mentor</option>
            </select>
            <p className="mt-2 text-xs text-[#6B7280]/80 leading-relaxed">
              Admin access is granted by invitation only
            </p>
          </div>
          {error && (
            <div className="rounded-lg bg-red-50/90 border border-red-200/50 p-4 text-sm text-red-800 backdrop-blur-sm">
              {error}
            </div>
          )}
          
          {/* Primary Create Account button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] px-6 py-4 md:py-3.5 text-white font-semibold shadow-md hover:shadow-lg hover:from-[#5A3A1A] hover:to-[#7D5538] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:transform-none transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2 focus:ring-offset-[#F8F5F2] min-h-[44px]"
          >
            {loading ? "Registering..." : "Create Account"}
          </button>
        </form>

        {/* Login link with secondary button styling */}
        <div className="pt-2">
          <p className="text-center text-sm text-[#6B7280]/90 mb-3">
            Already have an account?
          </p>
          <a 
            href="/auth/login" 
            className="block w-full rounded-xl border-2 border-[#CAAE92] bg-transparent px-6 py-4 md:py-3.5 text-center text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] active:scale-[0.98] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2 focus:ring-offset-[#F8F5F2] min-h-[44px]"
          >
            Login
          </a>
        </div>
      </div>
    </div>
  );
}
