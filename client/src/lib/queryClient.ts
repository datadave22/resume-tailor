import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Clerk token getter - set by AuthProvider so all API calls include Bearer tokens
let tokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(fn: (() => Promise<string | null>) | null) {
  tokenGetter = fn;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(queryKey.join("/") as string, {
      headers: authHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
