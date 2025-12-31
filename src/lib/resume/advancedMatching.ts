/**
 * Advanced resume-based job matching with TF-IDF and keyword overlap scoring
 */

export interface ResumeFeatures {
  skills: Set<string>;
  techStack: Set<string>;
  jobTitles: Set<string>;
  experienceKeywords: Set<string>;
  allKeywords: Set<string>;
}

export interface JobMatchResult {
  id: string;
  title: string;
  company: string;
  description?: string; // Mapped from jd_text
  location?: string | null;
  skills?: string[];
  tags?: string[];
  jd_text?: string; // Keep for backward compatibility
  source?: string;
  createdAt?: string;
  matchScore: number; // 0-100
  matchedSkills: string[];
  matchedTechStack: string[];
  matchedJobTitles: string[];
}

/**
 * Preprocess resume text to extract structured features
 */
export function preprocessResumeText(resumeText: string): ResumeFeatures {
  const text = resumeText.toLowerCase();
  
  // Technical skills database
  const technicalSkills = [
    // Programming languages
    "javascript", "typescript", "python", "java", "c++", "c#", "cpp", "go", "golang", "rust", 
    "php", "ruby", "swift", "kotlin", "scala", "r", "matlab", "perl", "lua",
    // Web frameworks
    "react", "vue", "angular", "svelte", "next.js", "nextjs", "nuxt", "gatsby",
    "node.js", "nodejs", "express", "nestjs", "fastify", "koa",
    "django", "flask", "fastapi", "spring", "spring boot", "laravel", "rails", "asp.net",
    // Databases
    "sql", "mongodb", "postgresql", "mysql", "redis", "elasticsearch", "cassandra", 
    "dynamodb", "oracle", "sqlite", "neo4j", "influxdb",
    // Cloud & DevOps
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s", "terraform",
    "ansible", "jenkins", "github actions", "gitlab ci", "circleci", "travis ci",
    // Frontend
    "html", "css", "sass", "scss", "less", "tailwind", "bootstrap", "material-ui", "mui",
    "webpack", "vite", "rollup", "parcel",
    // AI/ML
    "machine learning", "ml", "ai", "artificial intelligence", "deep learning", 
    "neural networks", "nlp", "natural language processing", "computer vision",
    "tensorflow", "pytorch", "scikit-learn", "keras", "pandas", "numpy",
    // Other
    "git", "github", "gitlab", "bitbucket", "svn",
    "rest api", "graphql", "grpc", "microservices", "serverless",
    "agile", "scrum", "kanban", "devops", "ci/cd", "tdd", "bdd",
    "testing", "jest", "cypress", "selenium", "pytest", "junit", "mocha", "chai",
    "linux", "unix", "bash", "shell scripting", "powershell"
  ];

  // Tech stack patterns (tools, platforms, methodologies)
  const techStackPatterns = [
    "cloud", "saas", "paas", "iaas", "serverless", "microservices",
    "api", "rest", "graphql", "soap", "websocket",
    "ci/cd", "devops", "sre", "infrastructure as code",
    "agile", "scrum", "kanban", "waterfall",
    "tdd", "bdd", "unit testing", "integration testing", "e2e testing"
  ];

  // Job title patterns
  const jobTitlePatterns = [
    "software engineer", "software developer", "web developer", "frontend developer",
    "backend developer", "full stack developer", "fullstack developer",
    "devops engineer", "sre", "site reliability engineer",
    "data engineer", "data scientist", "ml engineer", "ai engineer",
    "product manager", "project manager", "technical lead", "engineering manager",
    "architect", "solution architect", "system architect",
    "qa engineer", "test engineer", "quality assurance",
    "ui/ux designer", "product designer", "ux designer"
  ];

  // Experience keywords
  const experienceKeywords = [
    "years of experience", "years experience", "yoe", "yrs",
    "senior", "junior", "lead", "principal", "staff", "entry level",
    "internship", "intern", "co-op", "contract", "full-time", "part-time",
    "remote", "hybrid", "onsite", "on-site"
  ];

  // Extract skills
  const foundSkills = new Set<string>();
  for (const skill of technicalSkills) {
    if (text.includes(skill.toLowerCase())) {
      foundSkills.add(skill.toLowerCase());
    }
  }

  // Extract tech stack
  const foundTechStack = new Set<string>();
  for (const pattern of techStackPatterns) {
    if (text.includes(pattern.toLowerCase())) {
      foundTechStack.add(pattern.toLowerCase());
    }
  }

  // Extract job titles
  const foundJobTitles = new Set<string>();
  for (const title of jobTitlePatterns) {
    if (text.includes(title.toLowerCase())) {
      foundJobTitles.add(title.toLowerCase());
    }
  }

  // Extract experience keywords
  const foundExperience = new Set<string>();
  const experienceRegex = new RegExp(
    `(${experienceKeywords.join("|")}|\\d+\\s*(years?|yrs?)\\s*(of\\s*)?(experience|exp))`,
    "gi"
  );
  const experienceMatches = resumeText.match(experienceRegex);
  if (experienceMatches) {
    experienceMatches.forEach(match => {
      foundExperience.add(match.toLowerCase().trim());
    });
  }

  // Extract all meaningful keywords (excluding stop words)
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "as", "is", "was", "are", "were", "been", "be", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might", "can",
    "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
    "my", "your", "his", "her", "its", "our", "their", "me", "him", "us", "them",
    "work", "worked", "working", "experience", "experiences", "project", "projects"
  ]);

  const words = text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word.toLowerCase()));

  // Count word frequency
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    const lower = word.toLowerCase();
    wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1);
  }

  // Get top keywords (excluding already found skills/tech)
  const allKeywords = new Set<string>();
  Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .forEach(([word]) => {
      if (!foundSkills.has(word) && !foundTechStack.has(word)) {
        allKeywords.add(word);
      }
    });

  return {
    skills: foundSkills,
    techStack: foundTechStack,
    jobTitles: foundJobTitles,
    experienceKeywords: foundExperience,
    allKeywords,
  };
}

/**
 * Normalize job description text for matching
 */
export function normalizeJobDescription(jdText: string): string {
  return jdText
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate TF-IDF score (simplified version using keyword overlap)
 */
function calculateTFIDFScore(
  resumeFeatures: ResumeFeatures,
  jobText: string
): number {
  const normalizedJob = normalizeJobDescription(jobText);
  const jobWords = new Set(normalizedJob.split(/\s+/).filter(w => w.length >= 3));

  // Calculate overlap
  let overlap = 0;
  let totalResumeTerms = 0;

  // Skills overlap
  resumeFeatures.skills.forEach(skill => {
    totalResumeTerms++;
    if (jobWords.has(skill) || normalizedJob.includes(skill)) {
      overlap++;
    }
  });

  // Tech stack overlap
  resumeFeatures.techStack.forEach(tech => {
    totalResumeTerms++;
    if (jobWords.has(tech) || normalizedJob.includes(tech)) {
      overlap++;
    }
  });

  // Keywords overlap
  resumeFeatures.allKeywords.forEach(keyword => {
    totalResumeTerms++;
    if (jobWords.has(keyword) || normalizedJob.includes(keyword)) {
      overlap++;
    }
  });

  if (totalResumeTerms === 0) return 0;
  return (overlap / totalResumeTerms) * 100;
}

/**
 * Calculate comprehensive match score with bonus weights
 */
export function calculateMatchScore(
  resumeFeatures: ResumeFeatures,
  job: { title: string; company: string; jd_text?: string }
): {
  matchScore: number; // 0-100
  matchedSkills: string[];
  matchedTechStack: string[];
  matchedJobTitles: string[];
} {
  const jobText = `${job.title} ${job.company} ${job.jd_text || ""}`.toLowerCase();
  const normalizedJob = normalizeJobDescription(jobText);

  let score = 0;
  const matchedSkills: string[] = [];
  const matchedTechStack: string[] = [];
  const matchedJobTitles: string[] = [];

  // 1. Skills match (weight: 30 points max)
  let skillsScore = 0;
  resumeFeatures.skills.forEach(skill => {
    if (normalizedJob.includes(skill)) {
      const weight = job.title.toLowerCase().includes(skill) ? 5 : 3;
      skillsScore += weight;
      matchedSkills.push(skill);
    }
  });
  score += Math.min(skillsScore, 30);

  // 2. Tech stack match (weight: 25 points max)
  let techStackScore = 0;
  resumeFeatures.techStack.forEach(tech => {
    if (normalizedJob.includes(tech)) {
      techStackScore += 4;
      matchedTechStack.push(tech);
    }
  });
  score += Math.min(techStackScore, 25);

  // 3. Job title match (weight: 20 points max)
  let titleScore = 0;
  resumeFeatures.jobTitles.forEach(title => {
    if (job.title.toLowerCase().includes(title)) {
      titleScore += 10;
      matchedJobTitles.push(title);
    } else if (normalizedJob.includes(title)) {
      titleScore += 5;
      matchedJobTitles.push(title);
    }
  });
  score += Math.min(titleScore, 20);

  // 4. Experience level match (weight: 10 points max)
  let experienceScore = 0;
  resumeFeatures.experienceKeywords.forEach(exp => {
    if (normalizedJob.includes(exp)) {
      experienceScore += 2;
    }
  });
  score += Math.min(experienceScore, 10);

  // 5. Keyword overlap (TF-IDF style, weight: 15 points max)
  const keywordOverlap = calculateTFIDFScore(resumeFeatures, jobText);
  score += Math.min(keywordOverlap * 0.15, 15);

  // Normalize to 0-100 scale
  score = Math.min(Math.round(score), 100);

  return {
    matchScore: score,
    matchedSkills,
    matchedTechStack,
    matchedJobTitles,
  };
}


