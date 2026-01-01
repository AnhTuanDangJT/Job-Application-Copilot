import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/test/adzuna
 * 
 * Quick test route to verify Adzuna API is working
 * Tests with a simple Java search query
 */
export async function GET(req: NextRequest) {
  try {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;

    console.log("[TEST ADZUNA] Starting Adzuna API test...");
    console.log("[TEST ADZUNA] ADZUNA_APP_ID:", appId ? "***SET***" : "NOT SET");
    console.log("[TEST ADZUNA] ADZUNA_APP_KEY:", appKey ? "***SET***" : "NOT SET");

    if (!appId || !appKey) {
      return NextResponse.json(
        {
          success: false,
          error: "ADZUNA_APP_ID or ADZUNA_APP_KEY not configured",
          appIdSet: !!appId,
          appKeySet: !!appKey,
        },
        { status: 500 }
      );
    }

    // Test with a simple Java query
    const testQuery = "Java";
    const country = "us"; // Using US as default
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: "5", // Just fetch 5 for testing
      what: testQuery,
    });

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
    console.log("[TEST ADZUNA] Calling URL:", url.replace(appKey, "***KEY***"));

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    console.log("[TEST ADZUNA] Response status:", response.status);
    console.log("[TEST ADZUNA] Response statusText:", response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[TEST ADZUNA] API error response:", errorText);
      
      return NextResponse.json(
        {
          success: false,
          error: `Adzuna API returned ${response.status}: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const jobs = data.results || [];
    const jobCount = Array.isArray(jobs) ? jobs.length : 0;

    console.log("[TEST ADZUNA] API response received");
    console.log("[TEST ADZUNA] Jobs count:", jobCount);
    console.log("[TEST ADZUNA] Full response keys:", Object.keys(data));
    
    if (jobCount > 0) {
      console.log("[TEST ADZUNA] First job title:", jobs[0]?.title || "N/A");
      console.log("[TEST ADZUNA] First job company:", jobs[0]?.company?.[0]?.display_name || "N/A");
    }

    return NextResponse.json({
      success: true,
      message: `Adzuna API test successful - found ${jobCount} jobs`,
      query: testQuery,
      country: country,
      jobCount: jobCount,
      jobs: jobs.slice(0, 3).map((job: any) => ({
        id: job.id,
        title: job.title,
        company: job.company?.[0]?.display_name || job.company?.display_name,
        location: job.location?.[0]?.display_name || job.location?.display_name,
        url: job.redirect_url,
      })),
      rawResponseKeys: Object.keys(data),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("[TEST ADZUNA] Unexpected error:", errorMessage);
    console.error("[TEST ADZUNA] Stack:", errorStack);

    return NextResponse.json(
      {
        success: false,
        error: "Unexpected error occurred",
        message: errorMessage,
        stack: errorStack,
      },
      { status: 500 }
    );
  }
}












