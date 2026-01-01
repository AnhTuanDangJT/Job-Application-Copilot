// Simple API client for making authenticated requests
// Cookies are automatically sent with requests, no need to manually add them

// Get base API URL from environment variable (points to Railway backend)
// Falls back to relative path if not set (for local development with Next.js API routes)
const getBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    // Client-side: use NEXT_PUBLIC_API_URL or fall back to relative path
    return process.env.NEXT_PUBLIC_API_URL || "";
  }
  // Server-side: use NEXT_PUBLIC_API_URL or fall back to relative path
  return process.env.NEXT_PUBLIC_API_URL || "";
};

// Helper function to build API URLs - use this for all API calls
export const getApiUrl = (path: string): string => {
  const baseUrl = getBaseUrl();
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return baseUrl ? `${baseUrl}/api${cleanPath}` : `/api${cleanPath}`;
};

// Routes that must always fetch fresh data (user-specific, dynamic)
const FRESH_ROUTES = [
  "/auth/me",
  "/applications/history",
  "/apply/submit",
  "/analyze",
  "/coverletter/generate",
  "/resume/tailor",
  "/orchestrate/start",
  "/mentor-communication/conversations",
];

function needsFreshData(path: string): boolean {
  return FRESH_ROUTES.some((route) => path.startsWith(route));
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const url = getApiUrl(path);
    const response = await fetch(url, {
      method: "GET",
      credentials: "include", // Include cookies
      cache: needsFreshData(path) ? "no-store" : "default",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async post<T>(path: string, data?: unknown): Promise<T> {
    const options: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies
      cache: needsFreshData(path) ? "no-store" : "default",
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const url = getApiUrl(path);
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async patch<T>(path: string, data: unknown): Promise<T> {
    const url = getApiUrl(path);
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async delete<T>(path: string): Promise<T> {
    const url = getApiUrl(path);
    const response = await fetch(url, {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },
};
