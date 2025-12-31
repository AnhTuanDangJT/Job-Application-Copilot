import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/adminConfig";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

export default async function MenteeView() {
  const auth = await getServerAuth();
  
  // Only allow mentees to access this page - BLOCK admins
  if (!auth) {
    redirect("/dashboard");
  }
  
  // Fetch user from DB to check email and role
  await connectToDatabase();
  const user = await User.findById(auth.sub).lean();
  if (!user || Array.isArray(user)) {
    redirect("/dashboard");
  }
  
  // BLOCK admin users - admins should NOT access mentee view
  const isAdmin = isAdminEmail(user.email);
  if (isAdmin) {
    redirect("/dashboard/admin");
  }
  
  // Only allow mentees
  if (user.role !== "mentee") {
    redirect("/dashboard");
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Mentee View</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="font-medium">Job Matches</div>
          <div className="text-sm text-gray-600">No jobs yet. Start scraping from the Jobs tab.</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="font-medium">Resume Versions</div>
          <div className="text-sm text-gray-600">Your tailored resumes will appear here.</div>
        </div>
        <div className="rounded-lg border bg-white p-4 md:col-span-2">
          <div className="font-medium">Application History</div>
          <div className="text-sm text-gray-600">No applications yet.</div>
        </div>
      </div>
    </section>
  );
}


