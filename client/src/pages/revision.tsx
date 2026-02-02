import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  FileText, 
  ArrowLeft, 
  Download,
  Copy,
  Check,
  Clock,
  Briefcase,
  Building2
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Revision } from "@shared/schema";

export default function RevisionPage() {
  const { user } = useAuth();
  const params = useParams();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: revision, isLoading } = useQuery<Revision>({
    queryKey: ["/api/revisions", params.id],
  });

  const handleCopy = async () => {
    if (revision?.tailoredContent) {
      await navigator.clipboard.writeText(revision.tailoredContent);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Your tailored resume has been copied.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (revision?.tailoredContent) {
      const blob = new Blob([revision.tailoredContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${revision.targetRole.replace(/\s+/g, "-").toLowerCase()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary rounded-lg">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">ResumeTailor</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : revision ? (
          <>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold">{revision.targetRole}</h1>
                {revision.wasFree && <Badge variant="outline">Free Revision</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  <span>{revision.targetIndustry}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(revision.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Tailored Resume</CardTitle>
                  <CardDescription>
                    AI-optimized for {revision.targetIndustry} - {revision.targetRole}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    data-testid="button-copy"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    data-testid="button-download"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/30 p-6 rounded-lg">
                    {revision.tailoredContent}
                  </pre>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 flex justify-center gap-4">
              <Link href="/tailor">
                <Button variant="outline" data-testid="button-tailor-another">
                  Tailor Another Resume
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button data-testid="button-dashboard">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Revision not found</p>
            <Link href="/dashboard">
              <Button variant="outline" className="mt-4">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
