export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/adminConfig";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

export default async function MentorView() {
  const auth = await getServerAuth();
  
  // Only allow mentors to access this page - BLOCK admins
  if (!auth) {
    redirect("/dashboard");
  }
  
  // Fetch user from DB to check email and role
  await connectToDatabase();
  const user = await User.findById(auth.sub).lean();
  if (!user || Array.isArray(user)) {
    redirect("/dashboard");
  }
  
  // BLOCK admin users - admins should NOT access mentor view
  const isAdmin = isAdminEmail(user.email);
  if (isAdmin) {
    redirect("/dashboard/admin");
  }
  
  // Only allow mentors
  if (user.role !== "mentor") {
    redirect("/dashboard");
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Mentor View</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="font-medium">Mentee Progress</div>
          <div className="text-sm text-gray-600">No data yet.</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="font-medium">Feedback Panel</div>
          <div className="text-sm text-gray-600">Leave feedback on mentee resumes and applications.</div>
        </div>
      </div>
    </section>
  );
}


