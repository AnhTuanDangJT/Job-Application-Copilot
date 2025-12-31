"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Users, User, Shield } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "mentee" | "mentor";
  isAdmin: boolean;
  createdAt: string;
}

export default function AdminManagementClient() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "mentee" | "mentor">("all");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const url = roleFilter === "all" 
        ? "/api/admin/users" 
        : `/api/admin/users?role=${roleFilter}`;
      
      const response = await fetch(url, {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        router.push("/dashboard");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(user: User) {
    setUserToDelete(user);
    setShowDeleteModal(true);
  }

  async function confirmDelete() {
    if (!userToDelete) return;

    setDeletingUserId(userToDelete.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      setSuccess(`User ${userToDelete.name} deleted successfully`);
      setShowDeleteModal(false);
      setUserToDelete(null);
      
      // Refresh user list
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  }

  // Calculate stats
  const totalUsers = users.length;
  const adminUsers = users.filter(u => u.isAdmin).length;
  const mentorUsers = users.filter(u => u.role === "mentor" && !u.isAdmin).length;
  const menteeUsers = users.filter(u => u.role === "mentee" && !u.isAdmin).length;

  if (loading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-[#1F2937]">User Management</h1>
        <div className="text-[#6B7280]">Loading...</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1F2937]">User Management</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          View all users, filter by role, and manage user accounts
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg bg-white border border-[#CAAE92]/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-[#9C6A45]" />
            <div className="text-sm font-medium text-[#6B7280]">Total Users</div>
          </div>
          <div className="text-2xl font-bold text-[#1F2937]">{totalUsers}</div>
        </div>
        <div className="rounded-lg bg-white border border-[#CAAE92]/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-[#DC2626]" />
            <div className="text-sm font-medium text-[#6B7280]">Admin</div>
          </div>
          <div className="text-2xl font-bold text-[#1F2937]">{adminUsers}</div>
        </div>
        <div className="rounded-lg bg-white border border-[#CAAE92]/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-[#9C6A45]" />
            <div className="text-sm font-medium text-[#6B7280]">Mentors</div>
          </div>
          <div className="text-2xl font-bold text-[#1F2937]">{mentorUsers}</div>
        </div>
        <div className="rounded-lg bg-white border border-[#CAAE92]/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-[#16A34A]" />
            <div className="text-sm font-medium text-[#6B7280]">Mentees</div>
          </div>
          <div className="text-2xl font-bold text-[#1F2937]">{menteeUsers}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-lg bg-white border border-[#CAAE92]/30 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-[#6B7280]">Filter by role:</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | "mentee" | "mentor")}
            className="rounded-md border border-[#CAAE92]/30 px-3 py-2 text-sm focus:border-[#9C6A45] focus:outline-none focus:ring-1 focus:ring-[#9C6A45]"
          >
            <option value="all">All Users</option>
            <option value="mentee">Mentees</option>
            <option value="mentor">Mentors</option>
          </select>
        </div>
      </div>

      {/* Users List */}
      <div className="rounded-lg border border-[#CAAE92]/30 bg-white p-4 md:p-6">
        <h2 className="text-lg font-medium text-[#1F2937] mb-4">
          Users ({totalUsers})
        </h2>
        
        {users.length === 0 ? (
          <div className="text-center py-8 text-[#6B7280]">
            No users found
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-[#CAAE92]/30">
                <thead className="bg-[#F8F5F2]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B7280]">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B7280]">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B7280]">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B7280]">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B7280]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#CAAE92]/30">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-[#F8F5F2]">
                      <td className="px-4 py-3 text-sm text-[#1F2937]">
                        {user.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6B7280]">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {user.isAdmin ? (
                          <span className="inline-flex items-center rounded-full bg-[#DC2626] px-2.5 py-0.5 text-xs font-medium text-white">
                            ADMIN
                          </span>
                        ) : user.role === "mentor" ? (
                          <span className="inline-flex items-center rounded-full bg-[#CAAE92] px-2.5 py-0.5 text-xs font-medium text-[#734C23]">
                            Mentor
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[#F4E2D4] px-2.5 py-0.5 text-xs font-medium text-[#734C23]">
                            Mentee
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6B7280]">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!user.isAdmin && (
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={deletingUserId === user.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-lg border border-[#CAAE92]/30 bg-[#F8F5F2] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#1F2937] text-base mb-1">
                        {user.name}
                      </h3>
                      <p className="text-sm text-[#6B7280] break-words">
                        {user.email}
                      </p>
                    </div>
                    <div>
                      {user.isAdmin ? (
                        <span className="inline-flex items-center rounded-full bg-[#DC2626] px-2.5 py-0.5 text-xs font-medium text-white">
                          ADMIN
                        </span>
                      ) : user.role === "mentor" ? (
                        <span className="inline-flex items-center rounded-full bg-[#CAAE92] px-2.5 py-0.5 text-xs font-medium text-[#734C23]">
                          Mentor
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#F4E2D4] px-2.5 py-0.5 text-xs font-medium text-[#734C23]">
                          Mentee
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-[#6B7280]">
                    Created: {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                  {!user.isAdmin && (
                    <button
                      onClick={() => handleDelete(user)}
                      disabled={deletingUserId === user.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete User
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full md:mx-4 p-6 md:p-6">
            <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
              Delete User
            </h3>
            <p className="text-sm text-[#6B7280] mb-4">
              Are you sure you want to delete <strong>{userToDelete.name}</strong> ({userToDelete.email})?
            </p>
            <p className="text-xs text-red-600 mb-6">
              This action cannot be undone. All user data, conversations, and applications will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                disabled={deletingUserId === userToDelete.id}
                className="flex-1 rounded-md border border-[#CAAE92]/30 bg-white px-4 py-2 text-sm font-medium text-[#6B7280] hover:bg-[#F8F5F2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingUserId === userToDelete.id}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {deletingUserId === userToDelete.id ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}



