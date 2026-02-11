import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useClerk, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { setAuthTokenGetter } from "./queryClient";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
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
      return;
    }

    setIsFetching(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/auth/user", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
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

  const isLoading = !clerkLoaded || (isSignedIn && isFetching && !user);

  const login = () => {
    clerk.openSignIn();
  };

  const logout = () => {
    clerk.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
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
