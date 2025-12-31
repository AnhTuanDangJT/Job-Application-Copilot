"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { X, LayoutDashboard, MessageSquare, Bell, Calendar, FileText, LogOut, Users, Megaphone, CheckCircle, ArrowLeft, FileCheck, Sparkles, MessageCircle } from "lucide-react";

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: "mentee" | "mentor" | null;
  context?: "mentee" | "mentor";
}

interface TutorialSection {
  icon: React.ReactNode;
  title: string;
  description: string;
  learnMoreContent?: {
    whatItDoes: string;
    howToUse: string[];
    examples?: string[];
  };
}

const menteeSections: TutorialSection[] = [
  {
    icon: <LayoutDashboard className="w-6 h-6 text-[#734C23]" />,
    title: "Dashboard Overview",
    description: "View your application statistics, track progress, and access key features from your central dashboard.",
    learnMoreContent: {
      whatItDoes: "Your dashboard is the central hub where you can see all your job application statistics at a glance. Track your progress, view application counts, and quickly access important features.",
      howToUse: [
        "View your application statistics including total applications, interviews, offers, and rejections",
        "Access quick links to key features like job search, resume upload, and communication",
        "Monitor your progress over time with visual statistics",
        "Navigate to different sections using the sidebar menu"
      ],
      examples: [
        "Check how many applications you've submitted this week",
        "See which applications have moved to interview stage",
        "Quickly access your uploaded resume and cover letter"
      ]
    }
  },
  {
    icon: <MessageSquare className="w-6 h-6 text-[#734C23]" />,
    title: "Communication",
    description: "Chat with your mentor, share images, and receive personalized guidance on your job search journey.",
    learnMoreContent: {
      whatItDoes: "Communicate directly with your mentor through a real-time chat interface. Share images, get feedback on your resume, and receive personalized guidance throughout your job search.",
      howToUse: [
        "Start a conversation with your mentor from the Communication page",
        "Send text messages and images to share your progress",
        "Reply to specific messages by clicking the three-dot menu on any message",
        "Upload your resume directly in the chat for mentor review",
        "Use Shift+Enter to create a new line in your message",
        "Click on images to view them in full size and download if needed"
      ],
      examples: [
        "Share a screenshot of a job posting you're interested in",
        "Ask for feedback on your resume before submitting an application",
        "Reply to your mentor's questions to continue the conversation"
      ]
    }
  },
  {
    icon: <Bell className="w-6 h-6 text-[#734C23]" />,
    title: "Notifications & Group Announcements",
    description: "Stay updated with important notifications and group announcements from your mentor and community.",
    learnMoreContent: {
      whatItDoes: "Receive real-time notifications about important updates, group announcements, and messages from your mentor. Stay informed without constantly checking the app.",
      howToUse: [
        "Click the bell icon in the navbar to view all notifications",
        "Read group announcements that your mentor sends to all mentees",
        "Mark notifications as read to keep your inbox organized",
        "Notifications appear automatically when you receive new messages or announcements"
      ],
      examples: [
        "Get notified when your mentor sends a group announcement about upcoming deadlines",
        "Receive alerts when your mentor responds to your messages",
        "Stay updated on important mentorship program updates"
      ]
    }
  },
  {
    icon: <Calendar className="w-6 h-6 text-[#734C23]" />,
    title: "Reminders & Timeline",
    description: "Set and manage reminders for interviews, follow-ups, and important deadlines to stay organized.",
    learnMoreContent: {
      whatItDoes: "Keep track of important dates and deadlines with the reminders system. Set reminders for interviews, follow-ups, and other critical job search milestones.",
      howToUse: [
        "View your reminders in the dashboard or conversation view",
        "Set reminders for interviews, follow-ups, or thank-you notes",
        "Receive notifications when reminders are due",
        "Mark reminders as complete once you've taken action",
        "View your application timeline to see the progression of each application"
      ],
      examples: [
        "Set a reminder to follow up on an application after one week",
        "Create a reminder for an upcoming interview",
        "Track when to send a thank-you note after an interview"
      ]
    }
  },
  {
    icon: <FileText className="w-6 h-6 text-[#734C23]" />,
    title: "Resume Upload & Feedback",
    description: "Upload your resume and receive detailed feedback from your mentor to improve your application materials.",
    learnMoreContent: {
      whatItDoes: "Upload your resume (PDF or DOCX) and get AI-powered feedback including strengths, weaknesses, ATS optimization tips, and a quality score. Your mentor can also provide personalized feedback.",
      howToUse: [
        "Go to the Documents section on your dashboard",
        "Click 'Choose File' under CV/Resume and select your resume file (PDF or DOCX, max 5MB)",
        "Wait for the upload to complete - your resume text will be automatically extracted",
        "Use the AI Resume Grading feature to get instant feedback and a quality score",
        "Share your resume with your mentor through the chat for personalized feedback",
        "Download your resume anytime from the Documents section"
      ],
      examples: [
        "Upload your latest resume to get an AI quality score and improvement suggestions",
        "Share your resume with your mentor for detailed review before applying",
        "Use AI feedback to optimize your resume for ATS systems"
      ]
    }
  },
  {
    icon: <Sparkles className="w-6 h-6 text-[#734C23]" />,
    title: "AI Cover Letter Generator",
    description: "Generate tailored cover letters for any job application using AI, matching your resume to job requirements.",
    learnMoreContent: {
      whatItDoes: "Create professional, tailored cover letters in seconds using AI. The generator matches your resume content to job requirements and creates personalized cover letters in your preferred tone.",
      howToUse: [
        "Navigate to a job listing and click 'Generate Cover Letter'",
        "Paste or upload the job description",
        "Your resume content will be automatically used (or paste it manually)",
        "Select your preferred tone: Professional, Confident, or Friendly",
        "Click 'Generate' and wait for your tailored cover letter",
        "Review and edit the generated cover letter as needed",
        "Copy or download the final version"
      ],
      examples: [
        "Generate a professional cover letter for a software engineering position",
        "Create a confident cover letter for a leadership role",
        "Generate a friendly cover letter for a startup position"
      ]
    }
  },
  {
    icon: <FileCheck className="w-6 h-6 text-[#734C23]" />,
    title: "AI Resume Grading",
    description: "Get instant AI-powered feedback on your resume including strengths, weaknesses, ATS tips, and a quality score.",
    learnMoreContent: {
      whatItDoes: "Upload your resume and receive comprehensive AI analysis including a quality score (0-100), grade (A/B/C), strengths, weaknesses, and actionable ATS optimization tips.",
      howToUse: [
        "Upload your resume in the Documents section",
        "Click 'Grade Resume' or 'Check Resume' button",
        "Wait for AI analysis (usually takes 10-30 seconds)",
        "Review your score and grade displayed in a badge",
        "Read through strengths and weaknesses sections",
        "Follow the ATS optimization checklist to improve your resume",
        "Make improvements and re-grade to see score improvements"
      ],
      examples: [
        "Get an initial grade to see where your resume stands",
        "Use ATS tips to optimize keywords and formatting",
        "Address weaknesses to improve your score from B to A"
      ]
    }
  },
  {
    icon: <MessageCircle className="w-6 h-6 text-[#734C23]" />,
    title: "AI Resume Summary",
    description: "Generate a professional summary of your resume highlighting key skills, experience, and achievements.",
    learnMoreContent: {
      whatItDoes: "Create a concise, professional summary of your resume that highlights your key skills, experience, and achievements. Perfect for LinkedIn profiles, cover letter introductions, and networking.",
      howToUse: [
        "Upload your resume in the Documents section",
        "Click 'Generate Summary' button",
        "Wait for AI to analyze your resume and create a summary",
        "Review the generated summary with bullet points of your strengths",
        "Copy the summary for use in LinkedIn, cover letters, or networking",
        "Edit as needed to match your personal style"
      ],
      examples: [
        "Generate a summary for your LinkedIn profile",
        "Create an introduction paragraph for your cover letter",
        "Get a quick overview of your key strengths for networking"
      ]
    }
  },
  {
    icon: <LogOut className="w-6 h-6 text-[#734C23]" />,
    title: "Ending Mentorship",
    description: "When your mentorship period ends, you can review your progress and access your historical data.",
    learnMoreContent: {
      whatItDoes: "When your mentorship relationship ends, you retain access to all your historical data, conversations, and progress. Review your journey and continue using the platform independently.",
      howToUse: [
        "Your mentor will mark the mentorship as ended",
        "You'll receive a notification about the mentorship ending",
        "All your data, conversations, and applications remain accessible",
        "You can continue using AI features independently",
        "Review your progress and achievements from the mentorship period",
        "Export or download your resume and cover letters"
      ],
      examples: [
        "Review all feedback you received during the mentorship",
        "Access your application history and outcomes",
        "Continue using AI features for future job applications"
      ]
    }
  },
];

const mentorSections: TutorialSection[] = [
  {
    icon: <LayoutDashboard className="w-6 h-6 text-[#734C23]" />,
    title: "Mentor Overview",
    description: "Monitor all your mentees' progress, view statistics, and manage your mentorship activities from one place.",
    learnMoreContent: {
      whatItDoes: "Your mentor overview dashboard provides a comprehensive view of all your mentees' progress, application statistics, and key metrics. Monitor multiple mentees efficiently from one central location.",
      howToUse: [
        "View all your mentees in organized cards showing their key information",
        "See application statistics for each mentee: total applications, interviews, offers, rejections",
        "Identify mentees who need attention with the 'Attention Required' section",
        "Access quick actions to communicate with mentees or view their details",
        "Use filters and search to find specific mentees quickly"
      ],
      examples: [
        "Check which mentees have upcoming interviews",
        "Identify mentees who haven't submitted applications recently",
        "Review overall program statistics and success rates"
      ]
    }
  },
  {
    icon: <Users className="w-6 h-6 text-[#734C23]" />,
    title: "Managing Mentees",
    description: "View mentee profiles, track their applications, and provide personalized guidance to each mentee.",
    learnMoreContent: {
      whatItDoes: "Manage individual mentee relationships by viewing detailed profiles, tracking their application progress, and providing personalized guidance tailored to each mentee's goals and situation.",
      howToUse: [
        "Click on a mentee card to view their detailed profile",
        "Edit mentee metadata including target role, locations, season, and tags",
        "Track their application progress and status updates",
        "Add notes about each mentee for your reference",
        "View their resume and cover letter submissions",
        "Set reminders and follow-ups for important milestones"
      ],
      examples: [
        "Update a mentee's target role as their goals evolve",
        "Add notes about a mentee's interview performance",
        "Track which mentees are applying to which types of roles"
      ]
    }
  },
  {
    icon: <MessageSquare className="w-6 h-6 text-[#734C23]" />,
    title: "Chat & Media Sharing",
    description: "Communicate with mentees through chat, share images, and provide real-time support and feedback.",
    learnMoreContent: {
      whatItDoes: "Engage in real-time conversations with your mentees through a professional chat interface. Share images, provide feedback, and offer guidance as they navigate their job search.",
      howToUse: [
        "Select a mentee from your conversations list to start chatting",
        "Send text messages and images to provide guidance",
        "Reply to specific messages by clicking the three-dot menu",
        "Review mentees' resumes shared in the chat",
        "Provide feedback directly in the conversation",
        "Use Shift+Enter to create new lines in messages",
        "Click images to view them in full size"
      ],
      examples: [
        "Share a screenshot of a job posting that matches a mentee's profile",
        "Provide feedback on a mentee's resume directly in chat",
        "Reply to a mentee's question about interview preparation"
      ]
    }
  },
  {
    icon: <Megaphone className="w-6 h-6 text-[#734C23]" />,
    title: "Groups & Announcements",
    description: "Create groups, send announcements to multiple mentees, and manage group communications efficiently.",
    learnMoreContent: {
      whatItDoes: "Create groups of mentees and send announcements to multiple mentees at once. Use AI to rewrite your announcements for clarity and professionalism, ensuring your message is clear and well-structured.",
      howToUse: [
        "Create groups from the mentor overview page",
        "Add mentees to groups based on their interests, goals, or programs",
        "Write a draft announcement message",
        "Use the AI rewrite feature to improve clarity and professionalism",
        "Send the announcement to selected groups or all mentees",
        "View sent announcements and their delivery status",
        "Mentees receive announcements in their notifications"
      ],
      examples: [
        "Send an announcement about upcoming application deadlines to all mentees",
        "Create a group for mentees interested in tech roles and send targeted announcements",
        "Use AI to rewrite a quick message into a professional announcement"
      ]
    }
  },
  {
    icon: <FileText className="w-6 h-6 text-[#734C23]" />,
    title: "Giving Resume Feedback",
    description: "Review mentee resumes, provide detailed feedback, and help them improve their application materials.",
    learnMoreContent: {
      whatItDoes: "Review mentees' uploaded resumes and provide detailed, actionable feedback to help them improve. You can see AI-generated feedback and add your own personalized insights.",
      howToUse: [
        "View mentees' resumes in the chat or documents section",
        "Review AI-generated feedback and scores if available",
        "Provide detailed feedback through the chat or feedback panel",
        "Highlight specific areas for improvement",
        "Suggest concrete changes and improvements",
        "Track mentees' resume improvements over time"
      ],
      examples: [
        "Review a mentee's resume and provide feedback on their experience section",
        "Suggest improvements to make their resume more ATS-friendly",
        "Help a mentee tailor their resume for a specific job application"
      ]
    }
  },
  {
    icon: <LogOut className="w-6 h-6 text-[#734C23]" />,
    title: "Ending Mentorship",
    description: "Properly conclude mentorship relationships and ensure mentees have access to their progress history.",
    learnMoreContent: {
      whatItDoes: "When a mentorship period ends, you can properly conclude the relationship while ensuring mentees retain access to all their data, progress, and historical information.",
      howToUse: [
        "Mark a mentorship as ended from the conversation or mentee profile",
        "Provide final feedback and recommendations",
        "Ensure mentees have downloaded their resumes and important documents",
        "Mentees will retain access to all conversations and data",
        "Review the mentorship outcomes and success metrics"
      ],
      examples: [
        "End a successful mentorship after a mentee receives job offers",
        "Conclude a mentorship period at the end of a program",
        "Provide final guidance before ending the relationship"
      ]
    }
  },
];

interface LearnMoreModalProps {
  section: TutorialSection;
  onClose: () => void;
}

function LearnMoreModal({ section, onClose }: LearnMoreModalProps) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!section.learnMoreContent) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      {/* Light blur overlay */}
      <div
        className="absolute inset-0 bg-[#F8F5F2]/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#F8F5F2]/98 backdrop-blur-sm rounded-2xl shadow-xl border border-[#CAAE92]/20 flex flex-col animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#CAAE92]/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F4E2D4]">
              {section.icon}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#734C23]">{section.title}</h2>
              <p className="text-sm text-[#6B7280] mt-1">Detailed Guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* What This Feature Does */}
            <div>
              <h3 className="text-lg font-semibold text-[#734C23] mb-3">What This Feature Does</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed bg-white p-4 rounded-lg border border-[#CAAE92]/20">
                {section.learnMoreContent.whatItDoes}
              </p>
            </div>

            {/* How to Use */}
            <div>
              <h3 className="text-lg font-semibold text-[#734C23] mb-3">How to Use It</h3>
              <ol className="space-y-2">
                {section.learnMoreContent.howToUse.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F4E2D4] text-[#734C23] flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-sm text-[#6B7280] leading-relaxed pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Examples */}
            {section.learnMoreContent.examples && section.learnMoreContent.examples.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-[#734C23] mb-3">Examples</h3>
                <ul className="space-y-2">
                  {section.learnMoreContent.examples.map((example, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#CAAE92]/30 text-[#734C23] flex items-center justify-center text-xs mt-0.5">
                        <CheckCircle className="w-3 h-3" />
                      </span>
                      <span className="text-sm text-[#6B7280] leading-relaxed">{example}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#CAAE92]/30 bg-[#F8F5F2] flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
            >
              Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modalContent, document.body);
}

export default function TutorialModal({ isOpen, onClose, userRole, context }: TutorialModalProps) {
  const [selectedSection, setSelectedSection] = useState<TutorialSection | null>(null);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (selectedSection) {
          setSelectedSection(null);
        } else {
          onClose();
        }
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, selectedSection]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine which sections to show based on role and context
  let sections: TutorialSection[];
  let roleTitle: string;
  
  // Runtime guard: Mentor accounts must NEVER be admin
  const { user } = useAuth();
  if (user?.role === "mentor" && user?.isAdmin) {
    console.error("[TutorialModal] INVALID STATE: Mentor cannot be admin. Email:", user.email);
  }
  
  // Admin users (isAdmin=true) can view tutorials based on context
  // But they should NOT be treated as mentors - they have separate admin UI
  if (user?.isAdmin) {
    sections = context === "mentee" ? menteeSections : mentorSections;
    roleTitle = context === "mentee" ? "Mentee" : "Mentor";
  } else if (userRole === "mentor") {
    sections = mentorSections;
    roleTitle = "Mentor";
  } else {
    sections = menteeSections;
    roleTitle = "Mentee";
  }

  // Show Learn More modal if section is selected
  if (selectedSection) {
    return (
      <LearnMoreModal
        section={selectedSection}
        onClose={() => setSelectedSection(null)}
      />
    );
  }

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-0 md:p-4">
      {/* Backdrop - Light neutral overlay */}
      <div
        className="absolute inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full h-full md:h-auto md:max-w-3xl md:max-h-[90vh] bg-[#F8F5F2]/95 backdrop-blur-sm rounded-none md:rounded-2xl shadow-xl border-0 md:border border-[#CAAE92]/20 flex flex-col animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#CAAE92]/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F4E2D4]">
              <CheckCircle className="w-5 h-5 text-[#734C23]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#734C23]">How to Use</h2>
              <p className="text-sm text-[#6B7280] mt-1">{roleTitle} Guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {sections.map((section, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-lg border border-[#CAAE92]/30 bg-white hover:bg-[#F8F5F2] transition-colors"
              >
                <div className="flex-shrink-0 p-2 rounded-lg bg-[#F4E2D4]">
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#734C23] mb-1">{section.title}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed mb-3">{section.description}</p>
                  {section.learnMoreContent && (
                    <button
                      onClick={() => setSelectedSection(section)}
                      className="text-sm font-medium text-[#734C23] hover:text-[#9C6A45] underline transition-colors"
                    >
                      Learn More
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#CAAE92]/30 bg-[#F8F5F2] flex-shrink-0">
          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
            >
              Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level
  if (typeof window === "undefined") return null;

  return createPortal(modalContent, document.body);
}
