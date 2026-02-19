import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Crown
} from "lucide-react";

export default function PricingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<"starter" | "pro" | null>(null);

  const starterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payments/checkout", { planId: "basic" });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      setLoading(null);
      toast({ title: "Checkout failed", description: error.message, variant: "destructive" });
    },
  });

  const proMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payments/subscribe", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      setLoading(null);
      toast({ title: "Checkout failed", description: error.message, variant: "destructive" });
    },
  });

  const handleStarter = () => {
    setLoading("starter");
    starterMutation.mutate();
  };

  const handlePro = () => {
    setLoading("pro");
    proMutation.mutate();
  };

  if (!user) return null;

  const isSubscribed = user.subscriptionStatus === "active";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-primary rounded-md sm:rounded-lg">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm sm:text-lg">ResumePolish</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-12 max-w-3xl">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-4">Unlock More Tailoring</h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Land more interviews with AI-optimized resumes tailored to every job posting.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Starter — one-time */}
          <Card>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Starter</CardTitle>
              <CardDescription>One-time purchase</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$4.99</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">5 resume revisions</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {[
                  "5 AI-powered revisions",
                  "Industry-specific tailoring",
                  "Job description matching",
                  "Instant results",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant="outline"
                onClick={handleStarter}
                disabled={!!loading}
                data-testid="button-buy-starter"
              >
                {loading === "starter" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                ) : (
                  "Get 5 Revisions"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Pro — subscription */}
          <Card className="relative border-primary shadow-lg">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
            </div>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Pro</CardTitle>
              <CardDescription>Monthly subscription</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$7.99</span>
                <span className="text-muted-foreground ml-1">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Unlimited revisions</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {[
                  "Unlimited AI revisions",
                  "Industry-specific tailoring",
                  "Job description matching",
                  "Premium prompt quality",
                  "Cancel anytime",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                onClick={handlePro}
                disabled={!!loading || isSubscribed}
                data-testid="button-buy-pro"
              >
                {loading === "pro" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                ) : isSubscribed ? (
                  "Already Subscribed"
                ) : (
                  "Start Pro — $7.99/mo"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Pro is a monthly subscription. Starter is a one-time purchase. No surprise charges.
          </p>
          <p className="text-sm text-muted-foreground">
            Secure payment powered by Stripe.
          </p>
        </div>
      </main>
    </div>
  );
}
