import "dotenv/config";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";

async function main() {
  await connectToDatabase();

  await Promise.all([
    User.deleteMany({}),
    Job.deleteMany({}),
    Application.deleteMany({}),
  ]);

  const mentee = await User.create({
    name: "Alice Mentee",
    email: "alice@example.com",
    passwordHash: "dev-only",
    role: "mentee",
    profile: { skills: ["TypeScript", "React"], goals: "Find frontend internship" },
  });

  const job = await Job.create({
    title: "Frontend Intern",
    company: "Acme Inc",
    jd_text: "Looking for a frontend intern familiar with React and TypeScript.",
    source: "seed",
  });

  await Application.create({
    userId: mentee._id,
    jobId: job._id,
    status: "draft",
  });

  console.log("Seed complete.");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});


