"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export default function JobsSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      } else {
        params.delete("q");
      }
      router.push(`/jobs?${params.toString()}`);
    });
  }

  function handleClear() {
    setSearchQuery("");
    startTransition(() => {
      router.push("/jobs");
    });
  }

  return (
    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 md:gap-2">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by job title or company..."
        className="flex-1 rounded-lg border border-gray-300 px-4 py-3 md:py-2 text-base md:text-sm focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45] min-h-[44px]"
        disabled={isPending}
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full md:w-auto rounded-lg bg-[#734C23] px-6 py-4 md:py-2 text-white hover:bg-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45] disabled:opacity-50 min-h-[44px]"
      >
        {isPending ? "Searching..." : "Search"}
      </button>
      {searchQuery && (
        <button
          type="button"
          onClick={handleClear}
          disabled={isPending}
          className="w-full md:w-auto rounded-lg border border-gray-300 bg-white px-6 py-4 md:py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 min-h-[44px]"
        >
          Clear
        </button>
      )}
    </form>
  );
}





