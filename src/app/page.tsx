import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl p-8 sm:p-12">
        <h1 className="text-4xl font-semibold text-gray-900">Job Application Copilot</h1>
        <p className="mt-4 text-gray-600">
          A multi-agent system that helps students apply for jobs end-to-end.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/auth/login"
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-black"
          >
            Login
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
