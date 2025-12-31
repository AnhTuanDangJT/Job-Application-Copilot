import Link from "next/link";

export default function ConversationNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F5F2] px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-[#1F2937]">
            Conversation Unavailable
          </h1>
          <p className="text-[#6B7280]">
            This conversation doesn't exist, or you don't have access to it.
          </p>
        </div>
        
        <div className="pt-4">
          <Link
            href="/mentor-communication"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-[#734C23] text-white font-medium hover:bg-[#9C6A45] transition-colors duration-200 shadow-sm"
          >
            Back to Communications
          </Link>
        </div>
      </div>
    </div>
  );
}

