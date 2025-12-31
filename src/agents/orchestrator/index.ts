import { Log } from "@/models/Log";
import { connectToDatabase } from "@/lib/db";

type OrchestratorInput = {
  userId: string;
  jobId: string;
};

async function logStep(agentName: string, action: string, meta?: Record<string, unknown>) {
  await connectToDatabase();
  await Log.create({ agentName, action, meta });
}

export async function runPipeline(input: OrchestratorInput) {
  await logStep("Orchestrator", "start", input);
  await logStep("Scraper", "fetched_jobs", { count: 1 });
  await logStep("Analyzer", "computed_match", { score: 75 });
  await logStep("ResumeTailor", "generated_resume");
  await logStep("CoverLetter", "generated_cover");
  await logStep("Submission", "submitted_application");
  await logStep("Tracker", "tracked_status");
  await logStep("Orchestrator", "done", input);
  return { ok: true };
}


