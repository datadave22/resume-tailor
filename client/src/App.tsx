import { Switch, Route, Redirect } from "wouter";
import { useEffect, useRef } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import UploadPage from "@/pages/upload";
import TailorPage from "@/pages/tailor";
import PricingPage from "@/pages/pricing";
import RevisionPage from "@/pages/revision";
import PaymentSuccessPage from "@/pages/payment-success";
import PaymentCancelPage from "@/pages/payment-cancel";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminUsersPage from "@/pages/admin/users";
import AdminPromptsPage from "@/pages/admin/prompts";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, authError, login, refetchUser } = useAuth();
  const redirecting = useRef(false);

  // Redirect to sign-in as a side effect, not during render
  useEffect(() => {
    if (!isLoading && !authError && !user && !redirecting.current) {
      redirecting.current = true;
      login();
    }
  }, [isLoading, authError, user, login]);

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <p className="text-destructive mb-4">{authError}</p>
          <button onClick={() => refetchUser()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md mr-2">
            Retry
          </button>
          <button onClick={() => window.location.href = "/"} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md">
            Home
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    );
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, authError, login, refetchUser } = useAuth();
  const redirecting = useRef(false);

  useEffect(() => {
    if (!isLoading && !authError && !user && !redirecting.current) {
      redirecting.current = true;
      login();
    }
  }, [isLoading, authError, user, login]);

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <p className="text-destructive mb-4">{authError}</p>
          <button onClick={() => refetchUser()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md mr-2">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    );
  }

  if (user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function HomeRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <LandingPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/upload">
        <ProtectedRoute>
          <UploadPage />
        </ProtectedRoute>
      </Route>
      <Route path="/tailor">
        <ProtectedRoute>
          <TailorPage />
        </ProtectedRoute>
      </Route>
      <Route path="/pricing">
        <ProtectedRoute>
          <PricingPage />
        </ProtectedRoute>
      </Route>
      <Route path="/revisions/:id">
        <ProtectedRoute>
          <RevisionPage />
        </ProtectedRoute>
      </Route>
      <Route path="/checkout/success">
        <ProtectedRoute>
          <PaymentSuccessPage />
        </ProtectedRoute>
      </Route>
      <Route path="/checkout/cancel">
        <ProtectedRoute>
          <PaymentCancelPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <AdminRoute>
          <AdminDashboardPage />
        </AdminRoute>
      </Route>
      <Route path="/admin/users">
        <AdminRoute>
          <AdminUsersPage />
        </AdminRoute>
      </Route>
      <Route path="/admin/prompts">
        <AdminRoute>
          <AdminPromptsPage />
        </AdminRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

function App() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <AuthProvider>
              <Toaster />
              <Router />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
