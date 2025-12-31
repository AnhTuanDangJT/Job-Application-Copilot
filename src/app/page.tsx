"use client";

import Link from "next/link";
import { Users, ChartBar, Flag, MessageSquare, FileText, Target, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 md:pt-20 pb-12 sm:pb-16 md:pb-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[#1F2937] tracking-tight">
            Job Application Copilot
          </h1>
          <p className="mt-4 sm:mt-6 text-lg sm:text-xl md:text-2xl font-semibold text-[#1F2937]">
            A mentor-driven platform connecting mentees and mentors to reach real job milestones faster.
          </p>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-[#1F2937]/80 max-w-2xl mx-auto leading-relaxed">
            Connect with experienced mentors who guide you through your job search journey. 
            Track applications, improve resumes, get feedback, and reach your career milestones—all in one place.
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-xl bg-[#7A4A2E] px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-white hover:bg-[#6A3E24] transition-all duration-200 shadow-sm hover:shadow-lg w-full sm:w-auto min-h-[44px]"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-xl border-2 border-[#E5D5C3] bg-transparent px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-[#7A4A2E] hover:bg-[#EADBC8] transition-all duration-200 w-full sm:w-auto min-h-[44px]"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <div className="text-center mb-10 sm:mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#1F2937]">
            How It Works
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-[#E5D5C3] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#EADBC8] mb-4 sm:mb-6">
              <Users className="w-6 h-6 sm:w-7 sm:h-7 text-[#7A4A2E]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-[#1F2937] mb-3 sm:mb-4">
              Connect with a Mentor
            </h3>
            <p className="text-base sm:text-lg text-[#1F2937]/80 leading-relaxed">
              Get guidance from experienced mentors who help you plan your job search.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-[#E5D5C3] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#EADBC8] mb-4 sm:mb-6">
              <ChartBar className="w-6 h-6 sm:w-7 sm:h-7 text-[#7A4A2E]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-[#1F2937] mb-3 sm:mb-4">
              Track & Improve
            </h3>
            <p className="text-base sm:text-lg text-[#1F2937]/80 leading-relaxed">
              Manage applications, resumes, feedback, skill gaps, and progress in one place.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-[#E5D5C3] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#EADBC8] mb-4 sm:mb-6">
              <Flag className="w-6 h-6 sm:w-7 sm:h-7 text-[#7A4A2E]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-[#1F2937] mb-3 sm:mb-4">
              Reach Job Milestones
            </h3>
            <p className="text-base sm:text-lg text-[#1F2937]/80 leading-relaxed">
              Follow a structured path from preparation to interviews to offers.
            </p>
          </div>
        </div>
      </section>

      {/* Why Job Application Copilot Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <div className="text-center mb-10 sm:mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#1F2937]">
            Why Job Application Copilot
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-[#E5D5C3] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#EADBC8] mb-4 sm:mb-6">
              <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 text-[#7A4A2E]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-[#1F2937] mb-3 sm:mb-4">
              Mentor-guided Feedback
            </h3>
            <p className="text-base sm:text-lg text-[#1F2937]/80 leading-relaxed">
              Receive personalized feedback from experienced mentors to improve your applications.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-[#E5D5C3] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#EADBC8] mb-4 sm:mb-6">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-[#7A4A2E]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-[#1F2937] mb-3 sm:mb-4">
              Resume & Application Tracking
            </h3>
            <p className="text-base sm:text-lg text-[#1F2937]/80 leading-relaxed">
              Track all your applications and resume versions in one organized dashboard.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-[#E5D5C3] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#EADBC8] mb-4 sm:mb-6">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-[#7A4A2E]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-[#1F2937] mb-3 sm:mb-4">
              Skill Gap Insights
            </h3>
            <p className="text-base sm:text-lg text-[#1F2937]/80 leading-relaxed">
              Identify areas for improvement and track your skill development over time.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-[#E5D5C3] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#EADBC8] mb-4 sm:mb-6">
              <Target className="w-6 h-6 sm:w-7 sm:h-7 text-[#7A4A2E]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-[#1F2937] mb-3 sm:mb-4">
              Clear Progress Milestones
            </h3>
            <p className="text-base sm:text-lg text-[#1F2937]/80 leading-relaxed">
              Set and achieve clear milestones on your path to landing your dream job.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#1F2937] mb-6 sm:mb-8">
            Start Your Journey Today
          </h2>
          <p className="text-base sm:text-lg text-[#1F2937]/80 mb-8 sm:mb-10">
            Join mentees and mentors working together to achieve real job milestones.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center rounded-xl bg-[#7A4A2E] px-8 sm:px-10 py-3.5 sm:py-4 text-base sm:text-lg font-semibold text-white hover:bg-[#6A3E24] transition-all duration-200 shadow-sm hover:shadow-lg min-h-[44px]"
          >
            Start Your Journey
          </Link>
        </div>
      </section>
    </div>
  );
}
