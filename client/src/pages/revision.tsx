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
  Building2,
  Sparkles,
  ChevronRight
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
      const content = revision.tailoredContent;
      // Convert plain text to formatted HTML that Word renders cleanly
      const htmlContent = content
        .split("\n")
        .map((line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return "<br/>";
          // Section headers (all caps or ending with colon)
          if (/^[A-Z\s&\/]{4,}$/.test(trimmed) || /^#{1,3}\s/.test(trimmed)) {
            const headerText = trimmed.replace(/^#{1,3}\s*/, "");
            return `<h2 style="font-size:14pt;font-weight:bold;color:#1a1a1a;margin:16pt 0 6pt 0;border-bottom:1pt solid #cccccc;padding-bottom:4pt;">${headerText}</h2>`;
          }
          // Bullet points
          if (/^[-•*]\s/.test(trimmed)) {
            return `<li style="font-size:11pt;font-family:'Calibri',sans-serif;margin:2pt 0;line-height:1.4;">${trimmed.replace(/^[-•*]\s*/, "")}</li>`;
          }
          return `<p style="font-size:11pt;font-family:'Calibri',sans-serif;margin:3pt 0;line-height:1.4;">${trimmed}</p>`;
        })
        .join("\n");

      const doc = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:'Calibri',sans-serif;font-size:11pt;color:#1a1a1a;max-width:7.5in;margin:0.75in auto;line-height:1.4;}ul{padding-left:18pt;}</style>
</head><body>${htmlContent}</body></html>`;

      const blob = new Blob([doc], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${revision.targetRole.replace(/\s+/g, "-").toLowerCase()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
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

      <main className="container mx-auto px-4 py-4 sm:py-8 max-w-4xl">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : revision ? (
          <>
            <div className="mb-4 sm:mb-8">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h1 className="text-xl sm:text-3xl font-bold">{revision.targetRole}</h1>
                {revision.wasFree && <Badge variant="outline">Free Revision</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm sm:text-base text-muted-foreground">
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
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4">
                <div>
                  <CardTitle className="text-base sm:text-lg">Tailored Resume</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
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
                        <Check className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    data-testid="button-download"
                  >
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Download</span>
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

            {revision.wasFree && (
              <Card className="mt-6 border-primary/20 bg-primary/5">
                <CardContent className="py-5 px-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm mb-2">Upgrade for Premium Revisions</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Paid revisions use Fortune 500-standard formatting, aggressive ATS keyword matching,
                        humanized language that reads naturally to both recruiters and scanners, interview
                        talking points, and a Resume Strength Score — built to get you hired faster.
                      </p>
                      <Link href="/pricing">
                        <Button size="sm" className="gap-1">
                          View Plans <ChevronRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
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
