export interface ExternalJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;            // link to apply
  logoUrl?: string;       // company logo if available
  skills?: string[];      // tags / skills
  source?: string;        // which API, e.g. "Remotive"
  // Salary fields
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  // Job type (remote/hybrid/onsite)
  jobType?: "remote" | "onsite" | "hybrid";
  // AI ranking fields
  matchScore?: number;     // 0-100
  recommendation?: "high" | "medium" | "low";
}

