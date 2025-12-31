export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { isServerSuperAdmin } from "@/lib/serverAuth";
import AdminManagementClient from "./AdminManagementClient";

/**
 * Server component wrapper - ensures only super admin email can access this page
 * ⚠️ HARD RULE: Email-based authorization only - do NOT rely on role
 */
export default async function AdminView() {
  // SECURITY: Only super admin email can access this page
  const isSuperAdmin = await isServerSuperAdmin();
  if (!isSuperAdmin) {
    redirect("/dashboard");
  }

  return <AdminManagementClient />;
}
