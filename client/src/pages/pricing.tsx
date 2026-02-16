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
  Zap,
  Crown
} from "lucide-react";

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  revisions: number;
  pricePerRevision: number;
  popular?: boolean;
  icon: React.ReactNode;
  features: string[];
}

const pricingPlans: PricingPlan[] = [
  {
    id: "basic",
    name: "Starter",
    price: 499, // $4.99
    revisions: 5,
    pricePerRevision: 0.99,
    icon: <Sparkles className="h-6 w-6" />,
    features: [
      "5 resume revisions",
      "AI-powered optimization",
      "Industry-specific tailoring",
      "Instant results",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 999, // $9.99
    revisions: 15,
    pricePerRevision: 0.67,
    popular: true,
    icon: <Zap className="h-6 w-6" />,
    features: [
      "15 resume revisions",
      "AI-powered optimization",
      "Industry-specific tailoring",
      "Instant results",
      "Best value",
    ],
  },
  {
    id: "unlimited",
    name: "Power User",
    price: 1999, // $19.99
    revisions: 50,
    pricePerRevision: 0.40,
    icon: <Crown className="h-6 w-6" />,
    features: [
      "50 resume revisions",
      "AI-powered optimization",
      "Industry-specific tailoring",
      "Instant results",
      "Lowest price per revision",
    ],
  },
];

export default function PricingPage() {
  const { user, refetchUser } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiRequest("POST", "/api/payments/checkout", { planId });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCheckout = (planId: string) => {
    setSelectedPlan(planId);
    checkoutMutation.mutate(planId);
  };

  if (!user) return null;

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

      <main className="container mx-auto px-4 py-6 sm:py-12 max-w-5xl">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-4">Get More Revisions</h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Unlock more AI-powered resume tailoring. Perfect your resume for every job application.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {pricingPlans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                  {plan.icon}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>
                  {plan.revisions} resume revisions
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${(plan.price / 100).toFixed(2)}</span>
                  <span className="text-muted-foreground ml-1">one-time</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  ${plan.pricePerRevision.toFixed(2)} per revision
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleCheckout(plan.id)}
                  disabled={checkoutMutation.isPending}
                  data-testid={`button-buy-${plan.id}`}
                >
                  {checkoutMutation.isPending && selectedPlan === plan.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Get ${plan.revisions} Revisions`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Secure payment powered by Stripe. All purchases are one-time with no recurring charges.
          </p>
        </div>
      </main>
    </div>
  );
}
