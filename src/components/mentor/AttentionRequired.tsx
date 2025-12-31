"use client";

import Link from "next/link";
import { AlertCircle, Calendar, Clock, CheckCircle } from "lucide-react";

interface AttentionItem {
  conversationId: string;
  menteeName: string;
  menteeEmail: string;
  followUpsDueCount: number;
  interviewsCount: number;
}

interface AttentionRequiredProps {
  items: AttentionItem[];
}

export default function AttentionRequired({ items }: AttentionRequiredProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-[#F8F5F2] p-8 text-center shadow-sm border border-[#CAAE92]/30">
        <CheckCircle className="w-8 h-8 text-[#16A34A] mx-auto mb-3 opacity-50" strokeWidth={1.5} />
        <p className="text-sm text-[#6B7280] font-medium">No actions required right now.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/30">
      <div className="space-y-4">
        {items.map((item) => (
          <Link
            key={item.conversationId}
            href={`/mentor-communication/${item.conversationId}`}
            className="block p-4 rounded-lg bg-white hover:bg-[#F4E2D4]/50 border border-[#CAAE92]/20 hover:border-[#9C6A45]/30 transition-all duration-200 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-[#1F2937]">{item.menteeName}</h3>
                  <span className="text-xs text-[#6B7280]">({item.menteeEmail})</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {item.followUpsDueCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF3C7] border border-[#F59E0B]/20">
                      <Clock className="w-3.5 h-3.5 text-[#D97706]" strokeWidth={1.5} />
                      <span className="text-xs font-medium text-[#92400E]">
                        {item.followUpsDueCount} {item.followUpsDueCount === 1 ? "follow-up" : "follow-ups"} due
                      </span>
                    </div>
                  )}
                  {item.interviewsCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4E2D4] border border-[#CAAE92]/30">
                      <Calendar className="w-3.5 h-3.5 text-[#734C23]" strokeWidth={1.5} />
                      <span className="text-xs font-medium text-[#734C23]">
                        {item.interviewsCount} {item.interviewsCount === 1 ? "interview" : "interviews"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <AlertCircle className="w-5 h-5 text-[#9C6A45] flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}



