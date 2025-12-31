import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 md:pt-20 pb-8 sm:pb-12">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 tracking-tight">
            Job Application Copilot
          </h1>
          <p className="mt-4 sm:mt-6 text-lg sm:text-xl md:text-2xl font-semibold text-gray-700">
            A mentor-driven platform that helps students and early professionals land jobs faster.
          </p>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Connect with experienced mentors who guide you through your job search journey. 
            Our platform provides structured tools to track applications, improve resumes, get feedback, 
            and reach your career milestones—all in one place.
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-md bg-gray-900 px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-white hover:bg-black transition-colors w-full sm:w-auto min-h-[44px]"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors w-full sm:w-auto min-h-[44px]"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <div className="text-center mb-10 sm:mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">
            How It Works
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
          <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#F4E2D4] mb-4 sm:mb-6">
              <span className="text-2xl sm:text-3xl font-bold text-[#734C23]">1</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">
              Connect with a Mentor
            </h3>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Get guidance from experienced mentors who help you plan your job search.
            </p>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#F4E2D4] mb-4 sm:mb-6">
              <span className="text-2xl sm:text-3xl font-bold text-[#734C23]">2</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">
              Track & Improve
            </h3>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Manage applications, resumes, feedback, skill gaps, and progress in one place.
            </p>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#F4E2D4] mb-4 sm:mb-6">
              <span className="text-2xl sm:text-3xl font-bold text-[#734C23]">3</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">
              Reach Your Job Milestones
            </h3>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Follow a structured path from preparation to interviews to offers.
            </p>
          </div>
        </div>
      </section>

      {/* Why Job Application Copilot Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 bg-white">
        <div className="text-center mb-10 sm:mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">
            Why Job Application Copilot
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-start lg:items-center text-center sm:text-left lg:text-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#F4E2D4] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#734C23]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Mentor–Mentee Collaboration
              </h3>
              <p className="text-base text-gray-600">
                Real-time collaboration between mentors and mentees for personalized guidance.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-start lg:items-center text-center sm:text-left lg:text-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#F4E2D4] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#734C23]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Resume Reviews & Feedback
              </h3>
              <p className="text-base text-gray-600">
                Get expert feedback on your resume and track improvements over time.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-start lg:items-center text-center sm:text-left lg:text-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#F4E2D4] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#734C23]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Skill Gap Insights
              </h3>
              <p className="text-base text-gray-600">
                Identify and address skill gaps to improve your job market readiness.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-start lg:items-center text-center sm:text-left lg:text-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#F4E2D4] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#734C23]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Progress Milestones
              </h3>
              <p className="text-base text-gray-600">
                Track your journey from job search preparation to interviews to offers.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-start lg:items-center text-center sm:text-left lg:text-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#F4E2D4] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#734C23]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Built for Students & Early Professionals
              </h3>
              <p className="text-base text-gray-600">
                Specifically designed to help those starting their career journey.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-start lg:items-center text-center sm:text-left lg:text-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#F4E2D4] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#734C23]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Structured Approach
              </h3>
              <p className="text-base text-gray-600">
                Follow a proven framework to streamline your job application process.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <div className="bg-gradient-to-br from-[#F8F5F2] to-[#F4E2D4] rounded-lg sm:rounded-2xl p-8 sm:p-12 md:p-16 text-center border border-[#CAAE92]/30">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-6 sm:mb-8 max-w-3xl mx-auto">
            Your path to a job should be guided, not guessed.
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8 sm:mt-10">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-md bg-gray-900 px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-white hover:bg-black transition-colors w-full sm:w-auto min-h-[44px]"
            >
              Start as a Mentee
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-md border-2 border-[#734C23] bg-transparent px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-[#734C23] hover:bg-[#F4E2D4] transition-colors w-full sm:w-auto min-h-[44px]"
            >
              Become a Mentor
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="text-center">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
              Job Application Copilot
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              A mentor-driven platform connecting students and early professionals with experienced mentors
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              © {new Date().getFullYear()} Job Application Copilot. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
