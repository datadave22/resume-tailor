import { useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Sparkles, ArrowRight, FileText } from "lucide-react";

export default function PaymentSuccessPage() {
  const { refetchUser } = useAuth();
  const searchParams = useSearch();

  useEffect(() => {
    refetchUser();
  }, [refetchUser]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-green-100 dark:bg-green-900/30 rounded-full w-fit">
            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription className="text-base">
            Your revisions have been added to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-primary/10 text-center">
            <Sparkles className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="font-medium">Your revisions are ready to use!</p>
            <p className="text-sm text-muted-foreground">
              Start tailoring your resume for your dream job.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/tailor">
              <Button className="w-full" data-testid="button-tailor-now">
                Tailor Resume Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full" data-testid="button-dashboard">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
