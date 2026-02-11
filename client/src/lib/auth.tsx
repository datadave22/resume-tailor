import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useClerk, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { setAuthTokenGetter } from "./queryClient";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  login: () => void;
  logout: () => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded: clerkLoaded, isSignedIn, getToken } = useClerkAuth();
  const clerk = useClerk();
  const [user, setUser] = useState<User | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Register Clerk's getToken with the API client so all requests get Bearer tokens
  useEffect(() => {
    if (clerkLoaded && isSignedIn) {
      setAuthTokenGetter(getToken);
    } else {
      setAuthTokenGetter(null);
    }
  }, [clerkLoaded, isSignedIn, getToken]);

  const fetchUser = useCallback(async () => {
    if (!isSignedIn) {
      setUser(null);
      setAuthError(null);
      return;
    }

    setIsFetching(true);
    setAuthError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/auth/user", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        const errorText = await res.text().catch(() => "Unknown error");
        console.error("Auth API error:", res.status, errorText);
        setAuthError(`Server error (${res.status}). Please try again.`);
        setUser(null);
      }
    } catch (err) {
      console.error("Auth fetch error:", err);
      setAuthError("Could not connect to server. Please try again.");
      setUser(null);
    } finally {
      setIsFetching(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (clerkLoaded) {
      fetchUser();
    }
  }, [clerkLoaded, fetchUser]);

  const isLoading = !clerkLoaded || (isSignedIn && isFetching && !user && !authError);

  const login = () => {
    clerk.redirectToSignIn({ redirectUrl: window.location.origin + "/dashboard" });
  };

  const logout = () => {
    clerk.signOut();
    setUser(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      authError,
      login,
      logout,
      refetchUser: fetchUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
