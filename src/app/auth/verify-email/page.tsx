"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function VerifyEmailPage() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch: refetchAuth } = useAuth();

  const email = searchParams.get("email") || "";

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedCode = value.slice(0, 6).split("");
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (index + i < 6 && /^\d$/.test(char)) {
          newCode[index + i] = char;
        }
      });
      setCode(newCode);
      // Focus next empty input or last input
      const nextIndex = Math.min(index + pastedCode.length, 5);
      const nextInput = document.getElementById(`code-${nextIndex}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      }
      return;
    }

    if (value && !/^\d$/.test(value)) {
      return; // Only allow digits
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      if (prevInput) {
        (prevInput as HTMLInputElement).focus();
      }
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const codeString = code.join("");
    if (codeString.length !== 6) {
      setError("Please enter the complete 6-digit code");
      setLoading(false);
      return;
    }

    if (!email) {
      setError("Email is required");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: codeString }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Verification failed");
        setLoading(false);
        return;
      }

      // Update auth context
      await refetchAuth();

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;

    if (!email) {
      setError("Email is required");
      return;
    }

    setResendLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Failed to resend verification code");
        setResendLoading(false);
        return;
      }

      // Reset timer and set cooldown
      setTimeRemaining(600); // 10 minutes
      setResendCooldown(60); // 60 seconds cooldown
      setResendLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend verification code");
      setResendLoading(false);
    }
  };

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
      <div className="relative w-full max-w-[420px] space-y-8 rounded-2xl bg-[#F8F5F2]/95 backdrop-blur-sm p-10 shadow-xl border border-[#CAAE92]/20 animate-in">
        {/* Typography section */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-[#1F2937] tracking-tight">
            Verify Your Email
          </h1>
          <p className="text-sm text-[#6B7280]/90 leading-relaxed">
            We sent a 6-digit verification code to
          </p>
          <p className="text-sm font-medium text-[#734C23]">{email || "your email"}</p>
        </div>

        {/* Countdown timer */}
        {timeRemaining > 0 && (
          <div className="text-center">
            <p className="text-xs text-[#6B7280]">
              Code expires in: <span className="font-semibold text-[#734C23]">{formatTime(timeRemaining)}</span>
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-[#1F2937] mb-3 text-center">
              Enter verification code
            </label>
            <div className="flex gap-2 justify-center">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 border-[#CAAE92] bg-white/80 backdrop-blur-sm text-[#1F2937] focus:border-[#9C6A45] focus:ring-2 focus:ring-[#9C6A45]/20 focus:bg-white transition-all duration-150"
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50/90 border border-red-200/50 p-4 text-sm text-red-800 backdrop-blur-sm">
              {error}
            </div>
          )}

          {/* Verify button */}
          <button
            type="submit"
            disabled={loading || code.join("").length !== 6}
            className="w-full rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] px-6 py-3.5 text-white font-semibold shadow-md hover:shadow-lg hover:from-[#5A3A1A] hover:to-[#7D5538] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:transform-none transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2 focus:ring-offset-[#F8F5F2]"
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        {/* Resend code section */}
        <div className="pt-2 space-y-3">
          <p className="text-center text-sm text-[#6B7280]/90">
            Didn&apos;t receive the code?
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || resendCooldown > 0}
            className="w-full rounded-xl border-2 border-[#CAAE92] bg-transparent px-6 py-3.5 text-center text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2 focus:ring-offset-[#F8F5F2]"
          >
            {resendLoading
              ? "Sending..."
              : resendCooldown > 0
              ? `Resend code (${resendCooldown}s)`
              : "Resend Code"}
          </button>
        </div>
      </div>
    </div>
  );
}

