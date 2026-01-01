/**
 * Database Migration Script: Cleanup User Roles
 * 
 * CRITICAL: This script ensures ONLY dangtuananh04081972@gmail.com can be admin.
 * Mentor accounts must NEVER be admin.
 * 
 * This script:
 * 1. Sets all users (except admin email) to role='MENTOR' if they were 'admin'
 * 2. Ensures admin email has role='MENTOR' (admin status is email-based, not role-based)
 * 
 * Usage (DEV only):
 *   node scripts/cleanup-roles.js
 * 
 * Or run via API endpoint (requires admin login):
 *   POST /api/admin/fix-mentor-role
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const ADMIN_EMAIL = "dangtuananh04081972@gmail.com";

async function cleanupRoles() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to database");

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Step 1: Update all non-admin users - set role to MENTOR if they were admin
    const result = await User.updateMany(
      { email: { $ne: ADMIN_EMAIL } },
      [
        {
          $set: {
            role: {
              $cond: [
                { $eq: ["$role", "mentor"] },
                "mentor",
                { $cond: [{ $eq: ["$role", "admin"] }, "mentor", "mentee"] }
              ]
            }
          }
        }
      ]
    );

    console.log(`Updated ${result.modifiedCount} non-admin users`);

    // Step 2: Ensure admin email has role='mentor' (not 'admin')
    // Admin status is determined by email, not DB role
    const adminUser = await User.findOne({ email: ADMIN_EMAIL });
    if (adminUser) {
      if (adminUser.role === "admin") {
        adminUser.role = "mentor";
        await adminUser.save();
        console.log(`Updated admin email role from 'admin' to 'mentor'`);
      } else {
        console.log(`Admin email already has role: ${adminUser.role}`);
      }
    } else {
      console.log(`Admin email not found in database`);
    }

    // Step 3: Verify - check for any remaining 'admin' roles
    const adminRoleCount = await User.countDocuments({ role: "admin" });
    if (adminRoleCount > 0) {
      console.warn(`WARNING: Found ${adminRoleCount} users with role='admin'`);
      const adminUsers = await User.find({ role: "admin" }).select("email role");
      console.warn("Users with admin role:", adminUsers);
    } else {
      console.log("✓ No users with role='admin' found - cleanup successful!");
    }

    console.log("\n✅ Role cleanup completed!");
    console.log(`   - Admin email: ${ADMIN_EMAIL}`);
    console.log(`   - Admin status: Determined by email, not DB role`);
    console.log(`   - All users now have role='mentee' or 'mentor', never 'admin'`);

  } catch (error) {
    console.error("Error cleaning up roles:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database");
  }
}

// Run the cleanup
cleanupRoles();



