import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  FileText, 
  Upload, 
  Sparkles, 
  CreditCard, 
  LogOut, 
  Clock,
  ArrowRight,
  FileCheck,
  AlertCircle,
  Shield
} from "lucide-react";
import type { Resume, Revision } from "@shared/schema";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  const { data: resumes, isLoading: resumesLoading } = useQuery<Resume[]>({
    queryKey: ["/api/resumes"],
  });

  const { data: revisions, isLoading: revisionsLoading } = useQuery<Revision[]>({
    queryKey: ["/api/revisions"],
  });

  if (!user) return null;

  const displayName = user.firstName 
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user.email || 'User';

  const freeRevisionsLeft = 3 - (user.freeRevisionsUsed || 0);
  const totalRevisionsLeft = freeRevisionsLeft + (user.paidRevisionsRemaining || 0);
  const hasRevisions = totalRevisionsLeft > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">ResumeTailor</span>
          </div>
          <div className="flex items-center gap-2">
            {user.role === "admin" && (
              <Link href="/admin">
                <Button variant="outline" size="sm" data-testid="button-admin">
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
            <ThemeToggle />
            <Button variant="ghost" onClick={logout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {displayName}!</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revisions Left</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRevisionsLeft}</div>
              <p className="text-xs text-muted-foreground">
                {freeRevisionsLeft > 0 ? `${freeRevisionsLeft} free` : "Paid revisions only"}
                {user.paidRevisionsRemaining > 0 && freeRevisionsLeft > 0 && ` + ${user.paidRevisionsRemaining} paid`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resumes Uploaded</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {resumesLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{resumes?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">PDF & DOCX files</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tailored Versions</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {revisionsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{revisions?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">AI-optimized resumes</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {!hasRevisions && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-4 py-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="flex-1">
                <h3 className="font-semibold">You've used all your free revisions</h3>
                <p className="text-sm text-muted-foreground">
                  Purchase more revisions to continue tailoring your resume.
                </p>
              </div>
              <Link href="/pricing">
                <Button data-testid="button-buy-revisions">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Buy Revisions
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Resume
              </CardTitle>
              <CardDescription>
                Upload your resume in PDF or DOCX format to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/upload">
                <Button className="w-full" data-testid="button-upload-resume">
                  Upload New Resume
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Tailor Resume
              </CardTitle>
              <CardDescription>
                Optimize your resume for specific industries and roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/tailor">
                <Button 
                  className="w-full" 
                  variant={hasRevisions ? "default" : "secondary"}
                  disabled={!resumes?.length}
                  data-testid="button-tailor-resume"
                >
                  {resumes?.length ? "Tailor Resume" : "Upload a resume first"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {revisions && revisions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Revisions
              </CardTitle>
              <CardDescription>
                Your recently tailored resume versions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {revisions.slice(0, 5).map((revision) => (
                  <div
                    key={revision.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{revision.targetRole}</span>
                        <Badge variant="secondary">{revision.targetIndustry}</Badge>
                        {revision.wasFree && <Badge variant="outline">Free</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(revision.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Link href={`/revisions/${revision.id}`}>
                      <Button variant="ghost" size="sm" data-testid={`button-view-revision-${revision.id}`}>
                        View
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
              {revisions.length > 5 && (
                <div className="mt-4 text-center">
                  <Link href="/revisions">
                    <Button variant="ghost" data-testid="button-view-all-revisions">
                      View all revisions
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
