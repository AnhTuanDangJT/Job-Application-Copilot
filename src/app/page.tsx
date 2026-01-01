"use client";

import Link from "next/link";
import { Users, ChartBar, Flag, MessageSquare, FileText, Target, TrendingUp } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState, useEffect } from "react";

// Animated word-by-word headline component
function AnimatedHeadline({ phrases, className }: { phrases: string[]; className?: string }) {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    
    const interval = setInterval(() => {
      setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [phrases.length, prefersReducedMotion]);

  const currentPhrase = phrases[currentPhraseIndex];
  const words = currentPhrase.split(" ");

  return (
    <h1 className={className}>
      {words.map((word, index) => (
        <motion.span
          key={`${currentPhraseIndex}-${index}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.5,
            delay: prefersReducedMotion ? 0 : index * 0.1,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="inline-block mr-2"
        >
          {word}
        </motion.span>
      ))}
    </h1>
  );
}

// Scroll animation wrapper component
function ScrollAnimation({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 }}
      animate={prefersReducedMotion || isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.6,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const prefersReducedMotion = useReducedMotion();

  const headlinePhrases = [
    "Smarter Job Search",
    "AI-Powered Career Growth",
    "Your Personal Job Copilot",
  ];

  return (
    <div className="min-h-screen bg-[#f5efe9]">
      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 md:pt-28 pb-20 sm:pb-24 md:pb-32">
        <div className="text-center max-w-5xl mx-auto">
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <AnimatedHeadline
              phrases={headlinePhrases}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-[#4a2f1c] tracking-tight leading-tight"
            />
          </motion.div>
          
          <motion.p
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-8 sm:mt-10 text-xl sm:text-2xl md:text-3xl font-semibold text-[#4a2f1c]/90"
          >
            A mentor-driven platform connecting mentees and mentors to reach real job milestones faster.
          </motion.p>
          
          <motion.p
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-[#4a2f1c]/75 max-w-3xl mx-auto leading-relaxed"
          >
            Connect with experienced mentors who guide you through your job search journey. 
            Track applications, improve resumes, get feedback, and reach your career milestones, all in one place.
          </motion.p>
          
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-10 sm:mt-12 flex flex-col sm:flex-row gap-5 justify-center items-center"
          >
            <Link
              href="/auth/signup"
              className="group inline-flex items-center justify-center rounded-2xl bg-[#4a2f1c] px-8 sm:px-10 py-4 sm:py-4.5 text-base sm:text-lg font-semibold text-white hover:bg-[#5a3f2c] transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] w-full sm:w-auto min-h-[48px]"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-2xl border-2 border-[#4a2f1c]/30 bg-transparent px-8 sm:px-10 py-4 sm:py-4.5 text-base sm:text-lg font-semibold text-[#4a2f1c] hover:bg-[#4a2f1c]/5 hover:border-[#4a2f1c]/50 transition-all duration-300 w-full sm:w-auto min-h-[48px]"
            >
              Login
            </Link>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-28">
        <ScrollAnimation className="text-center mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[#4a2f1c]">
            How It Works
          </h2>
        </ScrollAnimation>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 max-w-6xl mx-auto">
          {[
            {
              icon: Users,
              title: "Connect with a Mentor",
              description: "Get guidance from experienced mentors who help you plan your job search.",
            },
            {
              icon: ChartBar,
              title: "Track & Improve",
              description: "Manage applications, resumes, feedback, skill gaps, and progress in one place.",
            },
            {
              icon: Flag,
              title: "Reach Job Milestones",
              description: "Follow a structured path from preparation to interviews to offers.",
            },
          ].map((item, index) => (
            <ScrollAnimation key={item.title} delay={index * 0.15}>
              <motion.div
                whileHover={prefersReducedMotion ? {} : { y: -8, transition: { duration: 0.3 } }}
                className="bg-white rounded-2xl p-8 sm:p-10 shadow-md border border-[#c8a165]/20 hover:shadow-xl hover:border-[#c8a165]/40 transition-all duration-300 h-full"
              >
                <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#c8a165]/20 to-[#c8a165]/10 mb-6">
                  <item.icon className="w-8 h-8 sm:w-9 sm:h-9 text-[#4a2f1c]" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-semibold text-[#4a2f1c] mb-4">
                  {item.title}
                </h3>
                <p className="text-base sm:text-lg text-[#4a2f1c]/75 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            </ScrollAnimation>
          ))}
        </div>
      </section>

      {/* Why Job Application Copilot Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-28">
        <ScrollAnimation className="text-center mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[#4a2f1c]">
            Why Job Application Copilot
          </h2>
        </ScrollAnimation>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10 max-w-5xl mx-auto">
          {[
            {
              icon: MessageSquare,
              title: "Mentor-guided Feedback",
              description: "Receive personalized feedback from experienced mentors to improve your applications.",
            },
            {
              icon: FileText,
              title: "Resume & Application Tracking",
              description: "Track all your applications and resume versions in one organized dashboard.",
            },
            {
              icon: TrendingUp,
              title: "Skill Gap Insights",
              description: "Identify areas for improvement and track your skill development over time.",
            },
            {
              icon: Target,
              title: "Clear Progress Milestones",
              description: "Set and achieve clear milestones on your path to landing your dream job.",
            },
          ].map((item, index) => (
            <ScrollAnimation key={item.title} delay={index * 0.1}>
              <motion.div
                whileHover={prefersReducedMotion ? {} : { y: -8, transition: { duration: 0.3 } }}
                className="bg-white rounded-2xl p-8 sm:p-10 shadow-md border border-[#c8a165]/20 hover:shadow-xl hover:border-[#c8a165]/40 transition-all duration-300 h-full"
              >
                <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#c8a165]/20 to-[#c8a165]/10 mb-6">
                  <item.icon className="w-8 h-8 sm:w-9 sm:h-9 text-[#4a2f1c]" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-semibold text-[#4a2f1c] mb-4">
                  {item.title}
                </h3>
                <p className="text-base sm:text-lg text-[#4a2f1c]/75 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            </ScrollAnimation>
          ))}
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24 md:py-32">
        <ScrollAnimation>
          <div className="relative rounded-3xl bg-gradient-to-br from-[#4a2f1c] via-[#5a3f2c] to-[#4a2f1c] p-12 sm:p-16 md:p-20 shadow-2xl overflow-hidden">
            {/* Subtle pattern overlay */}
            <div 
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `radial-gradient(circle at 20% 50%, #c8a165 0%, transparent 50%),
                                  radial-gradient(circle at 80% 80%, #c8a165 0%, transparent 50%)`,
              }}
            />
            
            <div className="relative text-center max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 sm:mb-8">
                Start Your Journey Today
              </h2>
              <p className="text-lg sm:text-xl md:text-2xl text-white/90 mb-10 sm:mb-12 leading-relaxed">
                Join mentees and mentors working together to achieve real job milestones.
              </p>
              <Link
                href="/auth/signup"
                className="group inline-flex items-center justify-center rounded-2xl bg-[#c8a165] hover:bg-[#d4b377] px-10 sm:px-12 py-4.5 sm:py-5 text-lg sm:text-xl font-semibold text-[#4a2f1c] transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] min-h-[52px]"
              >
                Start Your Journey
              </Link>
            </div>
          </div>
        </ScrollAnimation>
      </section>

      {/* Footer with Copyright */}
      <footer className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 border-t border-[#c8a165]/20">
        <div className="text-center">
          <p className="text-sm sm:text-base text-[#4a2f1c]/60">
            © {new Date().getFullYear()} Job Application Copilot. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
