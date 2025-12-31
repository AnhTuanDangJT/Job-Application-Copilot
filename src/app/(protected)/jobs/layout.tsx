import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/serverAuth";

export default async function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const payload = await getServerAuth();
  
  if (!payload) {
    redirect("/auth/login");
  }
  
  // Mentors cannot access jobs pages
  if (payload.role === "mentor") {
    redirect("/mentor/overview");
  }
  
  return <>{children}</>;
}





