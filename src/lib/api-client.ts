// Simple API client for making authenticated requests
// Cookies are automatically sent with requests, no need to manually add them

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
    const response = await fetch(`/api${path}`, {
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
    
    const response = await fetch(`/api${path}`, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async patch<T>(path: string, data: unknown): Promise<T> {
    const response = await fetch(`/api${path}`, {
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
    const response = await fetch(`/api${path}`, {
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
